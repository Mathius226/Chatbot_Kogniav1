async function test() {
  const res = await fetch('http://localhost:3000/api/admin/reindex', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer simple-admin-token'
    },
    body: JSON.stringify({ newDocuments: [{ id: '1', name: 'test.txt', content: 'hello', chunks: [], isIndexed: false }] })
  });
  console.log("Reindex:", res.status, await res.text());

  const res2 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queryText: "hola" })
  });
  console.log("Chat:", res2.status, await res2.text());
}
test();
