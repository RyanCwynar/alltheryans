import type { Client, InStatement, ResultSet } from "@libsql/client";
import { beginQuery, endQuery } from "./timing.js";

type ExecuteArg = InStatement | string;

/**
 * Wrap a libSQL client so each execute/batch counts toward request query stats.
 */
export function instrumentClient(client: Client): Client {
  const execute = client.execute.bind(client);
  const batch = client.batch?.bind(client);
  const transaction = client.transaction?.bind(client);

  const wrapped: Client = Object.create(client) as Client;

  wrapped.execute = async (stmt: ExecuteArg): Promise<ResultSet> => {
    beginQuery();
    try {
      return await execute(stmt);
    } finally {
      endQuery();
    }
  };

  if (batch) {
    wrapped.batch = (async (stmts: ExecuteArg[], mode?: Parameters<Client["batch"]>[1]) => {
      // One network round-trip; count as one logical query for stats.
      beginQuery();
      try {
        return await batch(stmts, mode);
      } finally {
        endQuery();
      }
    }) as Client["batch"];
  }

  if (transaction) {
    wrapped.transaction = ((...args: Parameters<Client["transaction"]>) =>
      transaction(...args)) as Client["transaction"];
  }

  return wrapped;
}
