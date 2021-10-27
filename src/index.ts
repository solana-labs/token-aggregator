import express from "express";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { NameRegistryState, TokenData } from "@bonfida/spl-name-service";
import {
  CDNTokenListResolutionStrategy,
  ENV,
  TokenInfo,
  TokenInfoMap,
} from "@solana/spl-token-registry";
import fetch from "cross-fetch";
import bs58 from "bs58";
import _ from "lodash";

const PORT = process.env.PORT || 5000;
const NAME_PROGRAM = "namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX";
const TOKEN_TLD = "6NSu2tci4apRKQtt257bAVcvqYjB3zV2H1dWo56vgpa6";
const CACHE_TIME = 15 * 60; // 15 minutes
const REFRESH_INTERVAL = CACHE_TIME * 1000;

const connection = new Connection(clusterApiUrl("mainnet-beta"));

let masterList = JSON.stringify({});

(async () => {
  await refreshList();

  express()
    .use((_, res, next) => {
      res.set("Cache-control", `public, max-age=${CACHE_TIME}`);
      next();
    })
    .get("/", (_, res) => res.send("SPL Token Aggregator"))
    .get("/solana.tokenlist.json", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(masterList);
    })
    .listen(PORT, () => console.log(`Listening on ${PORT}`));

  setInterval(async () => {
    await refreshList();
  }, REFRESH_INTERVAL);
})();

async function refreshList() {
  try {
    const tokenMap: TokenInfoMap = new Map();
    const cdnStrategy = new CDNTokenListResolutionStrategy();
    const tokenList = await fetch(cdnStrategy.repositories[0]);
    const jsonList = await tokenList.json();

    jsonList.tokens.forEach((tokenInfo: TokenInfo) =>
      tokenMap.set(tokenInfo.address, tokenInfo)
    );

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

    for (let acct of accts) {
      try {
        const tokenData = TokenData.deserialize(
          acct.account.data.slice(NameRegistryState.HEADER_LEN)
        );

        const address = bs58.encode(tokenData.mint);
        const tokenInfo = getTokenInfo(address, tokenData);

        if (tokenMap.has(tokenInfo.address)) {
          tokenMap.set(
            tokenInfo.address,
            _.merge(tokenMap.get(tokenInfo.address), tokenInfo)
          );
        } else {
          tokenMap.set(tokenInfo.address, tokenInfo);
        }
      } catch (error) {}
    }

    jsonList.tokens = [...tokenMap.values()];

    masterList = JSON.stringify(jsonList);
  } catch (error) {
    console.error(error);
  }
}

function getTokenInfo(address: string, tokenData: TokenData): TokenInfo {
  const { name, decimals, ticker: symbol } = tokenData;

  let tokenInfo: any = {
    address,
    chainId: ENV.MainnetBeta,
    decimals,
    name,
    symbol,
  };

  if (tokenData.logoUri) {
    tokenInfo.logoURI = tokenData.logoUri;
  }

  if (tokenData.website) {
    tokenInfo.extensions = {
      website: tokenData.website,
    };
  }

  return tokenInfo;
}
