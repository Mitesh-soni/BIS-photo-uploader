const express = require('express');
const app = express();
const port = 3001;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/login', (req, res) => {
    res.send(`
        <html>
        <body>
            <h1>Mock Portal Login</h1>
            <form action="/login" method="POST">
                <input type="text" id="username" name="username" placeholder="Username" />
                <input type="password" id="password" name="password" placeholder="Password" />
                <button type="submit" id="submit">Login</button>
            </form>
        </body>
        </html>
    `);
});

app.post('/login', (req, res) => {
    // mock login logic
    res.redirect('/huid-list');
});

app.get('/huid-list', (req, res) => {
    res.send(`
        <html>
        <body>
            <h1>HUID List</h1>
            <table id="huid-table">
                <tr><th>Tag</th><th>Category</th><th>Purity</th><th>HUID</th><th>Action</th></tr>
                <tr><td>1</td><td>Gold</td><td>22K</td><td>ABC123</td><td><a href="/upload?rowId=ABC123">Upload Image</a></td></tr>
                <tr><td>2</td><td>Gold</td><td>22K</td><td>XYZ789</td><td><a href="/upload?rowId=XYZ789">Upload Image</a></td></tr>
            </table>
        </body>
        </html>
    `);
});

app.get('/upload', (req, res) => {
    const rowId = req.query.rowId;
    res.send(`
        <html>
        <body>
            <h1>Upload Photo</h1>
            <form action="/upload" method="POST" enctype="multipart/form-data">
                <input type="hidden" id="rowId" name="rowId" value="${rowId}" />
                <select id="photoType" name="photoType">
                    <option value="article">Article</option>
                    <option value="huid">HUID</option>
                </select>
                <input type="file" id="photoFile" name="photoFile" />
                <button type="submit" id="uploadSubmit">Upload Photos</button>
            </form>
        </body>
        </html>
    `);
});

app.post('/upload', (req, res) => {
    res.send(`
        <html>
        <body>
            <script>
                alert('Photo uploaded successfully');
                window.location.href = '/image';
            </script>
        </body>
        </html>
    `);
});

app.get('/image', (req, res) => {
    res.send(`
        <html>
        <body>
            <h1>Image Verification Page</h1>
            <p id="status">Upload Successful</p>
            <p>Photo accepted.</p>
        </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(\`Mock portal running at http://localhost:\${port}\`);
});
