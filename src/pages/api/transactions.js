import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get the target public key from query params if provided
  const { targetPublicKey } = req.query;

  const client = new MongoClient(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017" || "mongodb://localhost:27017" 
  );

  try {
    await client.connect();
    const db = client.db("myDatabase");
    const collection = db.collection("myCollection");

    // Get the latest block to verify data
    const latestBlock = await collection.findOne({}, { sort: { _id: -1 } });
    console.log("Latest block:", {
      id: latestBlock.id,
      transactionCount: latestBlock.transactions.length,
    });

    const pipeline = [
      { $unwind: "$transactions" },
      {
        $match: {
          $or: [
            {
              "transactions.value.outputs": {
                $elemMatch: {
                  "public_keys.0": targetPublicKey,
                },
              },
            },
          ],
        },
      },
      { 
        $sort: { 
          "transactions.value.timestamp": -1,
          "_id": -1 
        }
      },
      { $project: { transaction: "$transactions", _id: 0 } },
    ];
    const transactions = await collection.aggregate(pipeline).toArray();
    console.log("Number of transactions found:", transactions.length);

    return res.status(200).json(transactions);
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: "Failed to fetch transactions" });
  } finally {
    await client.close();
  }
}
