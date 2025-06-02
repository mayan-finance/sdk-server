# sdk-server

# examples

- solana: `curl --request GET  --url 'http://localhost:3000/solana?amountIn=0.5&fromToken=0x0000000000000000000000000000000000000000&toToken=0x0000000000000000000000000000000000000000&fromChain=solana&toChain=base&slippageBps=auto&gasDrop=0&referrerBps=5&evmReferrer=0x4294844b7447A16f58E581F312dEDfd726157B27&solanaReferrer=Bv4jL8FWnqCCaZtUCFRqPdhCVp5vDsndh2aRduq4kc3V&swapperAddress=9xZJpqWx4Rzx5Mxxyxp1HXrNtbcZVZjfSftRr2aMWT88&destAddress=0x28A328C327307ab1b180327234fDD2a290EFC6DE&suiReferrer=0x80ab7e051d43f385b4346ae1a79c3a050cb40c5b99f9d1a95ec936945e7b9df2&useSeparateSwapTx=false' --header 'User-Agent: insomnia/9.3.2'`
    - returns transaction data including instructions and address lookup tables
- evm for gasless (with permit): `curl --request GET \
  --url 'http://localhost:3000/evm-gasless?amountIn=5&fromToken=0xaf88d065e77c8cc2239327c5edb3a432268e5831&toToken=0x0000000000000000000000000000000000000000&fromChain=arbitrum&toChain=base&slippageBps=300&gasDrop=0.001&referrerBps=5&evmReferrer=0x28A328C327307ab1b180327234fDD2a290EFC6DE&solanaReferrer=Bv4jL8FWnqCCaZtUCFRqPdhCVp5vDsndh2aRduq4kc3V&swapperAddress=0x28A328C327307ab1b180327234fDD2a290EFC6DE&destAddress=0x28A328C327307ab1b180327234fDD2a290EFC6DE&signerAddress=0x4294844b7447A16f58E581F312dEDfd726157B27&permitR=0x00&permitS=0x00&permitV=0&permitValue=0' \
  --header 'User-Agent: insomnia/9.3.2'`
    -  the result is a typed data that must be signed too by the user wallet. The signature can be used to call `createOrderWithSig` directly or you could upload signature data to the mayan explorer and our relayer system will pick it up
- evm: `curl --request GET \
  --url 'http://localhost:3000/evm?amountIn=0.5&fromToken=0x0000000000000000000000000000000000000000&toToken=0x0000000000000000000000000000000000000000&fromChain=arbitrum&toChain=base&slippageBps=300&gasDrop=0.001&referrerBps=5&evmReferrer=0x28A328C327307ab1b180327234fDD2a290EFC6DE&solanaReferrer=Bv4jL8FWnqCCaZtUCFRqPdhCVp5vDsndh2aRduq4kc3V&swapperAddress=0x28A328C327307ab1b180327234fDD2a290EFC6DE&destAddress=0x28A328C327307ab1b180327234fDD2a290EFC6DE&signerAddress=0x4294844b7447A16f58E581F312dEDfd726157B27' \
  --header 'User-Agent: insomnia/9.3.2'`

  - returns evm call data which could be signed and executed on chain
# shared params explanation
- amountIn: Number (for example 0.001 means 0.001 eth if token addr is 0x0000000000000000000000000000000000000000)
- fromToken: source Token on source chain. Use `0x0000000000000000000000000000000000000000` for native chain's token
- toToken: dest Token on source chain. Use `0x0000000000000000000000000000000000000000` for native chain's token
- fromChain: source chain name (
      "solana",
  "ethereum",
  "bsc",
  "polygon",
  "avalanche",
  "arbitrum",
  "optimism",
  "base" for now
)
- toChain: dest chain name
- slippageBps: number or 'auto' to set a suitable value automatically
- gasDrop: number. gas paid to user on destination chain if needed
- referrerBps: number to pay bps fees to the set referrer
- evmReferrer: and evm address that will be set to track transactions and pay referrer fees to
- solanaReferrer: solana equivalent of evmReferrer
- swapperAddress: the user wallet's address on source chain
- destAddress: the user wallet's address on dest chain

## solana: http://localhost:5000/solana
- relayerAddress: this solana address will pay the initiate tx cost. If the user wants to initiate it's the same as swapperAddress. otherwise set it to your own relayer. regardless of who pays the transaction both `relayerAddress` and `swapperAddress` must sign the final tx

## evm: http://localhost:5000/evm
- signerAddress (the one who will sign and pay. Will be the same as swapperAddress because user already has gas)

## evm gasless http://localhost:5000/evm-gasless
- permitValue (bignumber. value of permit)
- permitV (number v value of permit)
- permitS (hex string s value of permit)
- permitR (hex string r value of permit)