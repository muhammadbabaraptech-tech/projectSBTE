require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
// Your MongoDB Atlas connection string
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'sbte_evaluation';

let db;

async function connectDB() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('✅ Connected to MongoDB Atlas');
}

connectDB().catch(console.error);

// Helper: convert MongoDB _id to frontend-friendly id (keep original id field intact)
function formatDoc(doc) {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { mongoId: String(_id), ...rest };
}
function formatDocs(docs) { return docs.map(formatDoc); }

// ============ RECORDS ============
app.get('/api/records', async (req, res) => {
    const docs = await db.collection('records').find().toArray();
    res.json(formatDocs(docs));
});

app.post('/api/records/:key', async (req, res) => {
    await db.collection('records').replaceOne(
        { _id: req.params.key },
        { ...req.body, _id: req.params.key },
        { upsert: true }
    );
    res.json({ ok: true });
});

app.delete('/api/records/:key', async (req, res) => {
    await db.collection('records').deleteOne({ _id: req.params.key });
    res.json({ ok: true });
});

// ============ NOTES ============
app.get('/api/notes', async (req, res) => {
    const docs = await db.collection('notes').find().toArray();
    res.json(formatDocs(docs));
});

app.post('/api/notes/:id', async (req, res) => {
    await db.collection('notes').replaceOne(
        { _id: req.params.id },
        { ...req.body, _id: req.params.id },
        { upsert: true }
    );
    res.json({ ok: true });
});

app.delete('/api/notes/:id', async (req, res) => {
    await db.collection('notes').deleteOne({ _id: req.params.id });
    res.json({ ok: true });
});

// ============ SIMULATIONS ============
app.get('/api/simulations', async (req, res) => {
    const docs = await db.collection('simulations').find().toArray();
    res.json(formatDocs(docs));
});

app.post('/api/simulations/:id', async (req, res) => {
    await db.collection('simulations').replaceOne(
        { _id: req.params.id },
        { ...req.body, _id: req.params.id },
        { upsert: true }
    );
    res.json({ ok: true });
});

app.delete('/api/simulations/:id', async (req, res) => {
    await db.collection('simulations').deleteOne({ _id: req.params.id });
    res.json({ ok: true });
});

// ============ ATTENDANCE ============
app.get('/api/attendance', async (req, res) => {
    const docs = await db.collection('attendance').find().toArray();
    res.json(formatDocs(docs));
});

app.post('/api/attendance/:key', async (req, res) => {
    await db.collection('attendance').replaceOne(
        { _id: req.params.key },
        { ...req.body, _id: req.params.key },
        { upsert: true }
    );
    res.json({ ok: true });
});

// ============ STUDENT PASSWORDS ============
app.get('/api/settings/studentPasswords', async (req, res) => {
    const docs = await db.collection('studentPasswords').find().toArray();
    const result = {};
    docs.forEach(d => { result[d.id] = d.pw; });
    res.json(result);
});

app.post('/api/settings/studentPasswords/:id', async (req, res) => {
    await db.collection('studentPasswords').replaceOne(
        { _id: req.params.id },
        { _id: req.params.id, id: req.params.id, pw: req.body },
        { upsert: true }
    );
    res.json({ ok: true });
});

app.delete('/api/settings/studentPasswords/:id', async (req, res) => {
    await db.collection('studentPasswords').deleteOne({ _id: req.params.id });
    res.json({ ok: true });
});

// ============ LAYOUT ============
app.get('/api/settings/layout', async (req, res) => {
    const doc = await db.collection('settings').findOne({ type: 'layout' });
    res.json(doc ? doc.data : null);
});

app.post('/api/settings/layout', async (req, res) => {
    await db.collection('settings').replaceOne(
        { type: 'layout' },
        { type: 'layout', data: req.body },
        { upsert: true }
    );
    res.json({ ok: true });
});

// ============ SEATING ============
app.get('/api/settings/seating', async (req, res) => {
    const doc = await db.collection('settings').findOne({ type: 'seating' });
    res.json(doc ? doc.data : null);
});

app.post('/api/settings/seating', async (req, res) => {
    await db.collection('settings').replaceOne(
        { type: 'seating' },
        { type: 'seating', data: req.body },
        { upsert: true }
    );
    res.json({ ok: true });
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));