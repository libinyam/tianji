const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});

const db = app.database();

const COLLECTIONS_TO_BACKUP = [
  "posts",
  "ideas",
  "books",
  "workshops",
  "votes",
  "favorites",
  "notifications",
  "reports",
  "tags",
  "announcements",
  "user_roles",
];

const MAX_BATCH = 1000;

exports.main = async (event, context) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupId = `backup-${timestamp}`;
  const results = [];

  for (const collectionName of COLLECTIONS_TO_BACKUP) {
    try {
      const allDocs = [];
      let offset = 0;

      while (true) {
        const { data } = await db
          .collection(collectionName)
          .skip(offset)
          .limit(MAX_BATCH)
          .get();

        if (!data || data.length === 0) break;
        allDocs.push(...data);
        if (data.length < MAX_BATCH) break;
        offset += MAX_BATCH;
      }

      const backupDoc = {
        _id: `${backupId}_${collectionName}`,
        collection: collectionName,
        count: allDocs.length,
        data: allDocs,
        createdAt: new Date().toISOString(),
      };

      await db
        .collection("_backups")
        .doc(backupDoc._id)
        .set(backupDoc);

      results.push({
        collection: collectionName,
        count: allDocs.length,
        status: "ok",
      });
    } catch (err) {
      results.push({
        collection: collectionName,
        status: "error",
        error: err.message,
      });
    }
  }

  const totalDocs = results
    .filter((r) => r.status === "ok")
    .reduce((sum, r) => sum + r.count, 0);

  return {
    backupId,
    timestamp,
    totalDocs,
    collections: results,
  };
};
