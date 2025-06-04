import {
  ChainName,
  createSwapFromSolanaInstructions,
  fetchQuote,
  getJitoTipTransfer,
  getSwapFromEvmTxPayload,
} from "@mayanfinance/swap-sdk";
import { Connection, MessageV0, VersionedTransaction } from "@solana/web3.js";
import express, { Request, Response } from "express";
import { getSwiftFromEvmGasLessParams } from "./swift";
const app = express();
const port = 3000;

const solanaRpcUrl = process.env.SOLANA_RPC_URL;

const chainNames = [
  "solana",
  "ethereum",
  "bsc",
  "polygon",
  "avalanche",
  "arbitrum",
  "optimism",
  "base",
  "unichain",
  "linea",
  "sui"
];

const chainNameToId: any = {
  solana: 0,
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  avalanche: 43114,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  unichain: 130,
  linea: 59144,
};

app.get("/solana", async (req: Request, res: Response) => {
  try {
    if (!solanaRpcUrl) {
      throw new Error("SOLANA_RPC_URL env is not set");
    }

    const useSeparateSwapTx = req.query.useSeparateSwapTx === "true";
    const amountIn = Number(req.query.amountIn);
    const fromToken = req.query.fromToken!.toString();
    const toToken = req.query.toToken!.toString();
    const fromChain = req.query.fromChain!.toString();
    const toChain = req.query.toChain!.toString();
    const slippageBps = req.query.slippageBps === "auto" ? "auto" : Number(req.query.slippageBps);
    const gasDrop = Number(req.query.gasDrop);
    const referrerBps = Number(req.query.referrerBps);
    const evmReferrer = req.query.evmReferrer!.toString();
    const suiReferrer = req.query.suiReferrer!.toString();
    const solanaReferrer = req.query.solanaReferrer!.toString();
    const swapperWallet = req.query.swapperAddress!.toString();
    const relayerAddress = swapperWallet!.toString(); // used in solana swift only
    const destAddress = req.query.destAddress!.toString();
    if (!chainNames.includes(fromChain) || !chainNames.includes(toChain)) {
      res.status(406).send("Invalid chain name");
      return;
    }
    const quotes = await fetchQuote(
      {
        amount: Number(amountIn),
        fromToken: fromToken!.toString(),
        toToken: toToken!.toString(),
        fromChain: fromChain as ChainName,
        toChain: toChain as ChainName,
        slippageBps: slippageBps,
        gasDrop: gasDrop,
        referrerBps: referrerBps,
        referrer: fromChain === "solana" ? solanaReferrer : fromChain === "sui" ? suiReferrer : evmReferrer,
      },
      {
        gasless: false,
        mctp: true,
        onlyDirect: false,
        swift: true,
        wormhole: true,
        shuttle: false,
        fastMctp: true,
      }
    );

    let swiftQuote = quotes.find((q) => q.type === "SWIFT");
    if (!!swiftQuote) {
      swiftQuote!.relayer = relayerAddress;
    }

    let selectedQuote = quotes[0];

    const result = await createSwapFromSolanaInstructions(
      selectedQuote!,
      swapperWallet,
      destAddress,
      {
        evm: evmReferrer,
        solana: solanaReferrer,
        sui: suiReferrer,
      },
      new Connection(solanaRpcUrl), {
        allowSwapperOffCurve: true,
        forceSkipCctpInstructions: false,
        separateSwapTx: useSeparateSwapTx,
      }
    );

    let instructions: {
      programId: string;
      data: string;
      accounts: { isSigner: boolean; isWritable: boolean; pubkey: string }[];
    }[] = [];
    for (let ix of result.instructions) {
      instructions.push({
        programId: ix.programId.toString(),
        data: ix.data.toString("base64"),
        accounts: ix.keys.map((k) => ({
          isSigner: k.isSigner,
          isWritable: k.isWritable,
          pubkey: k.pubkey.toString(),
        })),
      });
    }

    const allTransactions : {
      addressLookupTableAddresses: string[],
      partialSigners: string[],
      instructions: any[],
    }[] = [];
   
    const swapMessageV0Params = result.swapMessageV0Params;
    if (swapMessageV0Params) {
      allTransactions.push({
        addressLookupTableAddresses: [],
        partialSigners: [Buffer.from(swapMessageV0Params.tmpTokenAccount.secretKey).toString('hex')],
        instructions: swapMessageV0Params.createTmpTokenAccountIxs.map((ix) => {
          return {
            programId: ix.programId.toString(),
            data: ix.data.toString("base64"),
            accounts: ix.keys.map((k) => ({
              isSigner: k.isSigner,
              isWritable: k.isWritable,
              pubkey: k.pubkey.toString(),
            })),
          }
        }),
      });
    
      allTransactions.push({
        addressLookupTableAddresses: swapMessageV0Params.messageV0.addressLookupTableAccounts?.map((lt) => lt.key.toString()) || [],
        instructions: swapMessageV0Params.messageV0.instructions.map((ix) => {
          return {
            programId: ix.programId.toString(),
            data: ix.data.toString("base64"),
            accounts: ix.keys.map((k) => ({
              isSigner: k.isSigner,
              isWritable: k.isWritable,
              pubkey: k.pubkey.toString(),
            })),
          }
        }),
        partialSigners: [],
      })
		}

    let mainTransaction: {
      addressLookupTableAddresses: string[],
      partialSigners: string[],
      instructions: any[],
    } = {
      addressLookupTableAddresses: result.lookupTables.map((lt) =>
        lt.key.toString()
      ),
      instructions: instructions,
      partialSigners: result.signers.map((s) => '0x' + Buffer.from(s.secretKey).toString("hex")),
    }

    allTransactions.push(mainTransaction);

    res.json({
      transactionDatas: allTransactions,
      selectedQuote,
    });
  } catch (err: any) {
    console.error(err, err.stack);
    res.status(500).send({err: err});
  }
});

app.get("/evm", async (req: Request, res: Response) => {
  try {
    const amountIn = Number(req.query.amountIn);
    const fromToken = req.query.fromToken!.toString();
    const toToken = req.query.toToken!.toString();
    const fromChain = req.query.fromChain!.toString();
    const toChain = req.query.toChain!.toString();
    const slippageBps = Number(req.query.slippageBps);
    const gasDrop = Number(req.query.gasDrop);
    const referrerBps = Number(req.query.referrerBps);
    const evmReferrer = req.query.evmReferrer!.toString();
    const solanaReferrer = req.query.solanaReferrer!.toString();
    if (!chainNames.includes(fromChain) || !chainNames.includes(toChain)) {
      res.status(406).send("Invalid chain name");
      return;
    }
    const quotes = await fetchQuote(
      {
        amount: Number(amountIn),
        fromToken: fromToken!.toString(),
        toToken: toToken!.toString(),
        fromChain: fromChain as ChainName,
        toChain: toChain as ChainName,
        slippageBps: slippageBps,
        gasDrop: gasDrop,
        referrerBps: referrerBps,
        referrer: fromChain === "solana" ? solanaReferrer : evmReferrer,
      },
      {
        gasless: false,
        mctp: false,
        onlyDirect: false,
        swift: true,
      }
    );

    let swiftQuote = quotes.find((q) => q.type === "SWIFT");
    if (!swiftQuote) {
      res.status(406).send("No SWIFT quote available");
    }

    const swapperWallet = req.query.swapperAddress!.toString();
    const signerAddress = req.query.signerAddress!.toString();;
    const destAddress = req.query.destAddress!.toString();
    const swap = getSwapFromEvmTxPayload(
      swiftQuote!,
      swapperWallet,
      destAddress,
      {
        evm: evmReferrer,
        solana: solanaReferrer,
      },
      signerAddress,
      chainNameToId[fromChain],
      null,
      null,
    );
    for (let i = 0; i < swap._forwarder.params.length; i++) {
      const item = swap._forwarder.params[i];
      if (typeof item === "bigint") {
        swap._forwarder.params[i] = item.toString();
      } else if (typeof item.value === "bigint") {
        swap._forwarder.params[i].value = item.value.toString();
      }
    }
    res.json(swap);
  } catch (err: any) {
    console.error(err, err.stack);
    res.status(500).send(err);
  }
});

app.get("/evm-gasless", async (req: Request, res: Response) => {
  try {
    const amountIn = Number(req.query.amountIn);
    const fromToken = req.query.fromToken!.toString();
    const toToken = req.query.toToken!.toString();
    const fromChain = req.query.fromChain!.toString();
    const toChain = req.query.toChain!.toString();
    const slippageBps = Number(req.query.slippageBps);
    const gasDrop = Number(req.query.gasDrop);
    const referrerBps = Number(req.query.referrerBps);
    const evmReferrer = req.query.evmReferrer!.toString();
    const solanaReferrer = req.query.solanaReferrer!.toString();
    if (!chainNames.includes(fromChain) || !chainNames.includes(toChain)) {
      res.status(406).send("Invalid chain name");
      return;
    }
    const quotes = await fetchQuote(
      {
        amount: Number(amountIn),
        fromToken: fromToken!.toString(),
        toToken: toToken!.toString(),
        fromChain: fromChain as ChainName,
        toChain: toChain as ChainName,
        slippageBps: slippageBps,
        gasDrop: gasDrop,
        referrerBps: referrerBps,
        referrer: fromChain === "solana" ? solanaReferrer : evmReferrer,
      },
      {
        gasless: true,
        mctp: false,
        onlyDirect: false,
        swift: true,
      }
    );

    let swiftQuote = quotes.find((q) => q.type === "SWIFT");
    if (!swiftQuote) {
      res.status(406).send("No SWIFT quote available");
    }

    const swiftGasless = await getSwiftFromEvmGasLessParams(
      swiftQuote!,
      req.query.swapperAddress!.toString(),
      req.query.destAddress!.toString(),
      fromChain === "solana" ? solanaReferrer : evmReferrer,
      chainNameToId[fromChain],
      {
        deadline: Number(req.query.permitDeadline),
        r: req.query.permitR!.toString(),
        s: req.query.permitS!.toString(),
        v: Number(req.query.permitV),
        value: BigInt(req.query.permitValue!.toString()),
      }
    );
    swiftGasless.orderTypedData.value.SubmissionFee = swiftGasless.orderTypedData.value.SubmissionFee.toString() as any;
    swiftGasless.orderTypedData.value.InputAmount = swiftGasless.orderTypedData.value.InputAmount.toString() as any;
    res.json(swiftGasless.orderTypedData);
  } catch (err: any) {
    console.error(err, err.stack);
    res.status(500).send(err);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
