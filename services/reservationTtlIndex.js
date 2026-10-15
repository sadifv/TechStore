const ensureReservationTtlIndex = async (collection) => {
    const collectionExists = await collection.conn.db
        .listCollections({ name: collection.collectionName }, { nameOnly: true })
        .hasNext();
    const indexes = collectionExists ? await collection.indexes() : [];
    const expiresAtIndex = indexes.find(index =>
        Object.keys(index.key).length === 1 && index.key.expiresAt === 1
    );

    if (expiresAtIndex?.expireAfterSeconds === 0) {
        return expiresAtIndex.name;
    }

    if (expiresAtIndex) {
        await collection.dropIndex(expiresAtIndex.name);
    }

    return collection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 }
    );
};

module.exports = { ensureReservationTtlIndex };
