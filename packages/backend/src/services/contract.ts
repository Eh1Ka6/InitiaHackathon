import { ethers } from "ethers";
import { config } from "../config";
// TODO: regenerate from artifacts once contracts build at
// packages/contracts/artifacts/contracts/core/DrawHub.sol/DrawHub.json
import DRAWHUB_ABI from "../abi/DrawHub.json";
import RANDOMNESS_ADAPTER_ABI from "../abi/RandomnessAdapter.json";

const WAGER_ABI = [
  "function createCompetition(bytes calldata params) external returns (uint256)",
  "function enter(uint256 competitionId, address player) external payable",
  "function startGame(uint256 competitionId) external",
  "function settle(uint256 competitionId, address[] calldata rankedWinners) external",
  "function cancel(uint256 competitionId) external",
  "function getWagerDetails(uint256 competitionId) external view returns (address,uint8,uint8,uint256,uint256,uint256,uint256,string)",
  "event WagerCreated(uint256 indexed competitionId, address indexed creator, uint8 wagerType, uint256 entryFee, string description)",
  "event GameStarted(uint256 indexed competitionId)",
  "event CompetitionSettled(uint256 indexed competitionId, address[] rankedWinners, uint256[] payouts)",
];

const ESCROW_ABI = [
  "event FundsLocked(uint256 indexed competitionId, address indexed player, uint256 amount)",
  "event FundsReleased(uint256 indexed competitionId, address indexed recipient, uint256 amount)",
  "event FundsRefunded(uint256 indexed competitionId, address indexed player, uint256 amount)",
];

function getProvider() {
  return new ethers.JsonRpcProvider(config.INITIA_RPC_URL);
}

function getWallet() {
  const provider = getProvider();
  return new ethers.Wallet(config.RESOLVER_PRIVATE_KEY, provider);
}

function getWagerContract() {
  return new ethers.Contract(config.WAGER_CONTRACT_ADDR, WAGER_ABI, getWallet());
}

export async function createCompetitionOnChain(
  wagerType: number,
  entryFee: bigint,
  deadline: number,
  maxPlayers: number,
  description: string
): Promise<{ txHash: string; competitionId: number }> {
  const contract = getWagerContract();
  const params = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint8", "uint256", "uint256", "uint256", "string"],
    [wagerType, entryFee, deadline, maxPlayers, description]
  );
  const tx = await contract.createCompetition(params);
  const receipt = await tx.wait();
  // Parse competitionId from event logs
  const event = receipt?.logs.find((l: any) => l.fragment?.name === "WagerCreated");
  const competitionId = event ? Number(event.args[0]) : 0;
  return { txHash: tx.hash, competitionId };
}

export async function startGameOnChain(competitionId: number): Promise<string> {
  const contract = getWagerContract();
  const tx = await contract.startGame(competitionId);
  await tx.wait();
  return tx.hash;
}

export async function settleOnChain(
  competitionId: number,
  winners: string[]
): Promise<string> {
  const contract = getWagerContract();
  const tx = await contract.settle(competitionId, winners);
  await tx.wait();
  return tx.hash;
}

export async function cancelOnChain(competitionId: number): Promise<string> {
  const contract = getWagerContract();
  const tx = await contract.cancel(competitionId);
  await tx.wait();
  return tx.hash;
}

/* ---------- DrawHub / RandomnessAdapter ---------- */

export function getDrawHubContract() {
  if (!config.DRAWHUB_ADDRESS) {
    throw new Error("DRAWHUB_ADDRESS env var not set");
  }
  return new ethers.Contract(config.DRAWHUB_ADDRESS, DRAWHUB_ABI as any, getWallet());
}

export function getDrawHubReadOnly() {
  if (!config.DRAWHUB_ADDRESS) {
    throw new Error("DRAWHUB_ADDRESS env var not set");
  }
  return new ethers.Contract(config.DRAWHUB_ADDRESS, DRAWHUB_ABI as any, getProvider());
}

export function getRandomnessAdapterContract() {
  if (!config.RANDOMNESS_ADAPTER_ADDRESS) {
    throw new Error("RANDOMNESS_ADAPTER_ADDRESS env var not set");
  }
  return new ethers.Contract(
    config.RANDOMNESS_ADAPTER_ADDRESS,
    RANDOMNESS_ADAPTER_ABI as any,
    getWallet()
  );
}

export { ESCROW_ABI, DRAWHUB_ABI, RANDOMNESS_ADAPTER_ABI, getProvider };
