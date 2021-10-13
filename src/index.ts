import express from "express";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { NameRegistryState, TokenData } from "@bonfida/spl-name-service";
import bs58 from "bs58";

const PORT = process.env.PORT || 5000;
const NAME_PROGRAM = "namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX";
const TOKEN_TLD = "6NSu2tci4apRKQtt257bAVcvqYjB3zV2H1dWo56vgpa6";
const CACHE_TIME = 15 * 60; // 15 minutes
const REFRESH_INTERVAL = CACHE_TIME * 1000;

const connection = new Connection(clusterApiUrl("mainnet-beta"));

let minimalList = JSON.stringify([]);
let detailedList = JSON.stringify([]);

(async () => {
  await refreshList();

  express()
    .use((_, res, next) => {
      res.set("Cache-control", `public, max-age=${CACHE_TIME}`);
      next();
    })
    .get("/", (_, res) => res.send("SPL Token Aggregator"))
    .get("/minimal-list.json", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(minimalList);
    })
    .get("/detailed-list.json", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(detailedList);
    })
    .listen(PORT, () => console.log(`Listening on ${PORT}`));

  setInterval(async () => {
    await refreshList();
  }, REFRESH_INTERVAL);
})();

async function refreshList() {
  try {
    let accts = await connection.getProgramAccounts(
      new PublicKey(NAME_PROGRAM),
      {
        filters: [
          {
            memcmp: {
              bytes: new PublicKey(TOKEN_TLD).toBase58(),
              offset: 0,
            },
          },
        ],
      }
    );

    const minimal = [];
    const detailed = [];

    for (let acct of accts) {
      try {
        const tokenData = TokenData.deserialize(
          acct.account.data.slice(NameRegistryState.HEADER_LEN)
        );

        const mint = bs58.encode(tokenData.mint);

        minimal.push({
          name: tokenData.name,
          symbol: tokenData.ticker,
          mint,
        });

        detailed.push({
          ...tokenData,
          mint,
        });
      } catch (error) {}
    }

    minimalList = JSON.stringify(minimal);
    detailedList = JSON.stringify(detailed);
  } catch (error) {
    console.error(error);
  }
}
