import { AddressLookupTableAccount, ComputeBudgetProgram, Connection, Keypair, MessageV0, PublicKey, sendAndConfirmRawTransaction, sendAndConfirmTransaction, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';

(async function main() {
    const wallet = Keypair.fromSecretKey(Buffer.from(process.env.SOLANA_PVK!, 'hex'));
    const {data: {transactionDatas}} = await axios.get('http://localhost:3000/solana', {
        params: {
            amountIn: '0.5',
            fromToken: '0x0000000000000000000000000000000000000000',
            toToken: '0x0000000000000000000000000000000000000000', 
            fromChain: 'solana',
            toChain: 'base',
            slippageBps: 'auto',
            gasDrop:'0',
            referrerBps: '5',
            evmReferrer:'0x4294844b7447A16f58E581F312dEDfd726157B27',
            solanaReferrer: 'Bv4jL8FWnqCCaZtUCFRqPdhCVp5vDsndh2aRduq4kc3V',
            swapperAddress: wallet.publicKey.toString(),
            destAddress:'0x28A328C327307ab1b180327234fDD2a290EFC6DE',
            suiReferrer: '0x80ab7e051d43f385b4346ae1a79c3a050cb40c5b99f9d1a95ec936945e7b9df2',
            useSeparateSwapTx: 'false',
        },
    });

    const data = transactionDatas[0];
    const connection = new Connection(process.env.SOLANA_RPC_URL!);

    const lookupTables: AddressLookupTableAccount[] = [];
    for (let rawLut of data.addressLookupTableAddresses) {
        const lut = await connection.getAddressLookupTable(new PublicKey(rawLut));
        if (!lut.value) {
            throw new Error(`Failed to get lookup table ${rawLut}`);
        }
        lookupTables.push(lut.value);
    }
    
    const messageV0 = MessageV0.compile({
        payerKey: wallet.publicKey,
        instructions: [...data.instructions.map((ix: any) => {
            return new TransactionInstruction({
                keys: ix.accounts.map((acc: any) => {
                    return {
                        pubkey: new PublicKey(acc.pubkey),
                        isSigner: acc.isSigner,
                        isWritable: acc.isWritable,
                    }
                }),
                programId: new PublicKey(ix.programId),
                data: Buffer.from(ix.data, 'base64'),
            })
        })],
        addressLookupTableAccounts: lookupTables,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    });


    const transaction = new VersionedTransaction(messageV0);
    const signers = [wallet];
    for (let signer of data.partialSigners) {
        signers.push(Keypair.fromSecretKey(Buffer.from(signer.replace('0x' ,''), 'hex')));
    }
    transaction.sign(signers);

    console.log(transaction.serialize());
    const txid = await sendAndConfirmRawTransaction(connection, Buffer.from(transaction.serialize()), {
        commitment: 'confirmed',
        maxRetries: 10,
        skipPreflight: false,
    });
    console.log(txid);
})();