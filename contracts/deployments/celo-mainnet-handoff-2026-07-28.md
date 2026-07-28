# Celo Mainnet Deployment Handoff (2026-07-28)

This deployment was broadcast from owner/deployer `0xafDeEbB89Cda1669361117eA2EAe3411F1228cb6` on chain `42220` (Celo Mainnet).

## Runtime configuration

- Payment token (USDC): `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
- Treasury: `0xafDeEbB89Cda1669361117eA2EAe3411F1228cb6`
- Continue price: `100000000000000000` (0.1 token units for 18-decimal token)

## Deployed contracts

Use proxy addresses in app integrations.

| Contract | Address | Explorer |
| --- | --- | --- |
| TournamentEscrow (proxy) | `0xe86aFBC33e46c61154119F965C406E4653C4bE68` | [View](https://celoscan.io/address/0xe86afbc33e46c61154119f965c406e4653c4be68) |
| PowerupShop (proxy) | `0xB5699C2940aEF13DA72213A2623BE83228548Dd4` | [View](https://celoscan.io/address/0xb5699c2940aef13da72213a2623be83228548dd4) |
| ContinuePurchase (proxy) | `0x4Cca748Bb75039C4402bA8de13e7A3372235FF93` | [View](https://celoscan.io/address/0x4cca748bb75039c4402ba8de13e7a3372235ff93) |
| TournamentEscrow (implementation) | `0x30bA59932f9952e88f911143ce13C0bAf8572690` | [View](https://celoscan.io/address/0x30ba59932f9952e88f911143ce13c0baf8572690) |
| PowerupShop (implementation) | `0xB856Ed599d8f989c7649E47D0f57Ef1Db4FE4a2a` | [View](https://celoscan.io/address/0xb856ed599d8f989c7649e47d0f57ef1db4fe4a2a) |
| ContinuePurchase (implementation) | `0x185475A05B9605E18C2d691dd23eCC6729c52855` | [View](https://celoscan.io/address/0x185475a05b9605e18c2d691dd23ecc6729c52855) |

## Deployment transactions

| Contract | Tx hash | Explorer |
| --- | --- | --- |
| TournamentEscrow implementation | `0x9babaaf27080a543fd85fa42241ec2b26b8f8fbfdec9f233f81e9b5ad8857c74` | [View](https://celoscan.io/tx/0x9babaaf27080a543fd85fa42241ec2b26b8f8fbfdec9f233f81e9b5ad8857c74) |
| PowerupShop implementation | `0x131eba27842f667b9be7aa0681e98e7c49c189623d02afd481fd918005bf8a7f` | [View](https://celoscan.io/tx/0x131eba27842f667b9be7aa0681e98e7c49c189623d02afd481fd918005bf8a7f) |
| ContinuePurchase implementation | `0x912b98d3fc043a0f2bb198a69f0d8f7cac25ebc5bdaaa361e5caa8deb9023e72` | [View](https://celoscan.io/tx/0x912b98d3fc043a0f2bb198a69f0d8f7cac25ebc5bdaaa361e5caa8deb9023e72) |
| TournamentEscrow proxy | `0x8f8abddcea97e6f50dc2ff0e9ddd8ed7d5bb055adf961ecfe474c526cd19d262` | [View](https://celoscan.io/tx/0x8f8abddcea97e6f50dc2ff0e9ddd8ed7d5bb055adf961ecfe474c526cd19d262) |
| PowerupShop proxy | `0x92091dd31c5c2eb9fddc0bc4778536e207bfafdb4b6a3bf670aca63a85e5fa52` | [View](https://celoscan.io/tx/0x92091dd31c5c2eb9fddc0bc4778536e207bfafdb4b6a3bf670aca63a85e5fa52) |
| ContinuePurchase proxy | `0xd617e17602e3d7b9025e04cf01792657db8dec34557b0bceea5b951c6aeb3a4a` | [View](https://celoscan.io/tx/0xd617e17602e3d7b9025e04cf01792657db8dec34557b0bceea5b951c6aeb3a4a) |

## Verification status

- Proxies: verified (ERC1967Proxy)
- Implementations: verified

Verification was confirmed through Celoscan/Etherscan V2 contract source API for all six addresses.

## Artifacts

- Address book JSON: `contracts/deployments/celo-mainnet.json`
- Broadcast metadata: `contracts/broadcast/DeploySepolia.s.sol/42220/run-latest.json`
