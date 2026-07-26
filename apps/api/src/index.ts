import Fastify from "fastify";
import {
  CELO_SEPOLIA_CHAIN_ID,
  TOURNAMENT_ALLOWS_CONTINUES,
  TOURNAMENT_HOUSE_RAKE_BPS,
} from "@trickshot/shared";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  service: "trickshot-api",
  stack: {
    chainId: CELO_SEPOLIA_CHAIN_ID,
    tournamentHouseRakeBps: TOURNAMENT_HOUSE_RAKE_BPS,
    tournamentAllowsContinues: TOURNAMENT_ALLOWS_CONTINUES,
  },
}));

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
