require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const app = express();
const port = 3000;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração do transporte de e-mail com Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false,
    },
});

// Conexão com PostgreSQL
const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

client.connect()
    .then(() => console.log('Conectado ao banco de dados PostgreSQL com sucesso!'))
    .catch(err => console.error('Erro ao conectar ao banco de dados PostgreSQL:', err));

// Configuração de sessões
app.use(session({
    secret: 'meuSegredoMuitoSecreto',
    resave: false,
    saveUninitialized: true,
}));

// Função para verificar se o usuário está logado
function verificarLogin(req, res, next) {
    if (!req.session.usuarioId) {
        return res.redirect('/login');
    }
    next();
}

// Rota inicial
app.get('/', (req, res) => {
    // Verifica se está logado
    if (req.session.admin) {
        return res.redirect('/dashboard-admin'); // Redireciona para o dashboard do administrador
    } else if (req.session.user) {
        return res.redirect('/responder'); // Redireciona para responder avaliações
    }
    return res.redirect('/login'); // Usuário não autenticado vai para a tela de login
});

// Página de Login (GET)
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body>
            <div class="container mt-4">
                <h1>Login</h1>
                <form action="/login" method="POST" class="form-group">
                    <input type="email" name="email" class="form-control mb-2" placeholder="E-mail" required>
                    <input type="password" name="senha" class="form-control mb-2" placeholder="Senha" required>
                    <button type="submit" class="btn btn-primary">Entrar</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// Processar o login (POST)
// Configuração de login para diferentes tipos de usuários
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const result = await client.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            const usuario = result.rows[0];
            const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
            if (senhaCorreta) {
                if (usuario.tipo === 'administrador') {
                    req.session.admin = { id: usuario.id, email: usuario.email };
                    return res.redirect('/dashboard-admin');
                } else if (usuario.tipo === 'usuario') {
                    req.session.user = { id: usuario.id, email: usuario.email };
                    return res.redirect('/responder');
                }
            }
        }
        res.send('Credenciais inválidas!');
    } catch (err) {
        console.error('Erro no login:', err);
        res.send('Erro ao fazer login.');
    }
});

// Dashboard do Administrador
app.get('/dashboard-admin',verificarLogin,verificarAdministrador,async (req, res) => {
    const campanhas = await carregarCampanhas();
    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sistema de Avaliação</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet" />
        <style>
            body {
                background-color: #f8f9fa;
                color: #343a40;
                font-family: Arial, sans-serif;
            }
            nav {
                box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
            }
            .container {
                text-align: center;
            }
            h1 {
                margin-top: 20px;
                color: #007bff;
                font-weight: bold;
            }
            h3 {
                margin-bottom: 20px;
                color: #495057;
            }
            .list-group-item {
                border: 1px solid #dee2e6;
                border-radius: 5px;
                margin-bottom: 10px;
                background-color: #fff;
                box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);
            }
            .btn-primary {
                background-color: #007bff;
                border-color: #007bff;
            }
            .btn-primary:hover {
                background-color: #0056b3;
                border-color: #004085;
            }
            .btn-danger {
                background-color: #dc3545;
                border-color: #dc3545;
            }
            .btn-danger:hover {
                background-color: #a71d2a;
                border-color: #891122;
            }
        </style>
    </head>
    <body>
        <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="/">
                    <img fetchpriority="high" decoding="async" width="100px" height="40px"
                    src="https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1.webp" 
                    class="attachment-full size-full wp-image-6626" 
                    alt srcset="https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1.webp 768w, 
                    https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1-300x123.webp 300w" sizes="(max-width: 768px) 100vw, 768px">
                </a>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav">
                        <li class="nav-item"><a class="nav-link text-white" href="/criar-campanha">Criar Campanha</a></li>
                        <li class="nav-item"><a class="nav-link text-white" href="/perguntas">Perguntas</a></li>
                    </ul>
                </div>
                <div class="d-flex">
                    <a href="/logout" class="btn btn-danger">Sair</a>
                </div>
            </div>
        </nav>
        <div class="container mt-4">
            <h1>Bem-vindo ao Sistema de Avaliação</h1>
            <h3>Campanhas Criadas:</h3>
            <ul class="list-group mx-auto" style="max-width: 600px;">
                ${campanhas.map(c => `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${c.titulo}</strong><br>
                            <span>${c.descricao}</span>
                        </div>
                        <div>
                            <a href="/enviar-avaliacao/${c.id}" class="btn btn-primary btn-sm">Enviar</a>
                            <form action="/excluir-campanha" method="POST" style="display: inline;">
                                <input type="hidden" name="id" value="${c.id}" />
                                <button type="submit" class="btn btn-danger btn-sm">Excluir</button>
                            </form>
                        </div>
                    </li>`).join('')}
            </ul>
        </div>
    </body>
    </html>
    `);
});

async function excluirCampanhaDoBanco(id) {
    try {
        await client.query('DELETE FROM campanhas WHERE id = $1', [id]);
        console.log(`Campanha com ID ${id} foi excluída.`);
    } catch (error) {
        console.error('Erro ao excluir campanha do banco:', error);
        throw error;
    }
}

app.post('/excluir-campanha', verificarLogin, verificarAdministrador, async (req, res) => {
    const id = req.body.id;

    try {
        await excluirCampanhaDoBanco(id);
        res.redirect('/dashboard-admin'); // Redireciona para o dashboard
    } catch (error) {
        console.error("Erro ao excluir campanha:", error);
        res.status(500).send("Erro ao excluir a campanha.");
    }
});

// Página de Login para Usuários (GET)
app.get('/usuario-login', (req, res) => {
    res.send(`
        <html>
        <head>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet" />
        </head>
        <body>
            <div class="container mt-4">
                <h1>Login de Usuário</h1>
                <form action="/usuario-login" method="POST" class="form-group">
                    <input type="email" name="email" class="form-control mb-2" placeholder="E-mail" required />
                    <input type="password" name="senha" class="form-control mb-2" placeholder="Senha" required />
                    <button type="submit" class="btn btn-primary">Entrar</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// Processar o login do usuário (POST)
app.post('/usuario-login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const result = await client.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        if (result.rows.length > 0) {
            const usuario = result.rows[0];

            const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
            if (senhaCorreta && usuario.tipo === 'usuario') {
                req.session.usuarioId = usuario.id;
                req.session.tipoUsuario = usuario.tipo; // Salva o tipo do usuário na sessão

                // Verifica se há uma campanha pendente para redirecionar
                if (req.session.campanhaRedirect) {
                    const campanhaId = req.session.campanhaRedirect;
                    delete req.session.campanhaRedirect; // Remove da sessão após uso
                    return res.redirect(`/responder/${campanhaId}`);
                }

                return res.redirect('/responder'); // Redireciona para a página padrão de responder avaliações
            } else {
                return res.send('Credenciais incorretas ou acesso restrito!');
            }
        } else {
            return res.send('Usuário não encontrado!');
        }
    } catch (err) {
        console.error('Erro ao tentar fazer login de usuário:', err);
        res.send('Erro ao fazer login!');
    }
});

// Verificar se o usuário é administrador
// Verificar se o administrador está logado
function verificarAdministrador(req, res, next) {
    if (!req.session.admin) {
        return res.status(403).send(`
            <div class="container mt-4 text-center">
                <h1 class="text-danger">Acesso Negado!</h1>
                <p>Esta página é restrita a administradores.</p>
                <a href="/login" class="btn btn-primary mt-3">Voltar para Login</a>
            </div>
        `);
    }
    next();
}

function verificarLogin(req, res, next) {
    if ( !req.session.admin &&!req.session.usuarioId) {
        return res.redirect('/login');
    }
    
    // Verifica se o tipo de usuário está tentando acessar página restrita
    if (req.session.tipoUsuario === 'usuario' && req.originalUrl === '/dashboard-admin') {
        return res.status(403).send(`
            <html>
            <head>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet" />
            </head>
            <body>
                <div class="container mt-4 text-center">
                    <h1 class="text-danger">Acesso Negado!</h1>
                    <p>Usuários não têm permissão para acessar a página inicial.</p>
                    <a href="/logout" class="btn btn-primary mt-3">Sair</a>
                </div>
            </body>
            </html>
        `);
    }

    next();
}




// Rota de logout
app.get('/logout', (req, res) => {
    if (req.session.admin) {
        req.session.admin = null;
    }
    if (req.session.user) {
        req.session.user = null;
    }
    req.session.destroy(err => {
        if (err) {
            return res.send('Erro ao fazer logout.');
        }
        res.redirect('/login');
    });
});



// Função para carregar campanhas do banco de dados
async function carregarCampanhas() {
    try {
        const result = await client.query('SELECT * FROM campanhas');
        return result.rows;
    } catch (err) {
        console.error('Erro ao carregar campanhas:', err);
        return [];
    }
}

// Rota para criar nova campanha
app.get('/criar-campanha', verificarLogin, verificarAdministrador, (req, res) => {
    res.send(`
        <html>
        <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="/">
                    <img fetchpriority="high" decoding="async" width="100px" height="40px"
                    src="https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1.webp" 
                    class="attachment-full size-full wp-image-6626" 
                    alt srcset="https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1.webp 768w, 
                    https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1-300x123.webp 300w" sizes="(max-width: 768px) 100vw, 768px">
                </a>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav">
                        <li class="nav-item "><a class="nav-link text-white" href="/criar-campanha ">Criar Campanha</a></li>
                        <li class="nav-item"><a class="nav-link text-white" href="/perguntas">Perguntas</a></li>
                    </ul>
                </div>
                <div class="d-flex">
                    <a href="/logout" class="btn btn-danger">Sair</a>
                </div>
            </div>
        </nav>
        <head>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet" />
        </head>
        <body>
            <div class="container mt-4">
                <h1>Criar Nova Campanha</h1>
                <form action="/criar-campanha" method="POST" class="form-group">
                    <input type="text" class="form-control mb-2" name="titulo" placeholder="Título" required />
                    <input type="text" class="form-control mb-2" name="descricao" placeholder="Descrição" required />
                    <button type="submit" class="btn btn-success">Criar</button>
                </form>
                <a href="/" class="btn btn-secondary mt-2">Voltar</a>
            </div>
        </body>
        </html>
    `);
});


// Processar criação da campanha e salvar no banco
app.post('/criar-campanha', async (req, res) => {
    const { titulo, descricao } = req.body;
    try {
        const result = await client.query(
            'INSERT INTO campanhas (titulo, descricao) VALUES ($1, $2) RETURNING id',
            [titulo, descricao]
        );
        res.redirect('/');
    } catch (err) {
        console.error('Erro ao criar campanha:', err);
        res.send('Erro ao criar campanha');
    }
});

// Rota para adicionar perguntas a uma campanha
app.get('/perguntas', verificarAdministrador,async (req, res) => {
    const campanhas = await carregarCampanhas();

    res.send(
        `<html>
        <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="/">
                    <img fetchpriority="high" decoding="async" width="100px" height="40px"
                    src="https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1.webp" 
                    class="attachment-full size-full wp-image-6626" 
                    alt srcset="https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1.webp 768w, 
                    https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1-300x123.webp 300w" sizes="(max-width: 768px) 100vw, 768px">
                </a>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav">
                        <li class="nav-item "><a class="nav-link text-white" href="/criar-campanha ">Criar Campanha</a></li>
                        <li class="nav-item"><a class="nav-link text-white" href="/perguntas">Perguntas</a></li>
                    </ul>
                </div>
                <div class="d-flex">
                    <a href="/logout" class="btn btn-danger">Sair</a>
                </div>
            </div>
        </nav>
        <head>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet" />
        </head>
        <body>
            <div class="container mt-4">
                <h1>Adicionar Perguntas</h1>
                <form action="/adicionar-perguntas" method="POST">
                    <div class="form-group mb-3">
                        <label>Selecione uma Campanha:</label>
                        <select name="campanhaId" class="form-select" required>
                        ${campanhas.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('')}
                        </select>
                    </div>
                    <div id="perguntas-container" class="form-group">
                        <label>Pergunta:</label>
                        <input type="text" name="perguntas[]" class="form-control mb-2" required />
                    </div>
                    <button type="button" onclick="adicionarPergunta()" class="btn btn-secondary">Adicionar outra Pergunta</button>
                    <button type="submit" class="btn btn-primary mt-3">Adicionar Perguntas</button>
                </form>
                <a href="/" class="btn btn-secondary mt-2">Voltar</a>
                <script>
                    function adicionarPergunta() {
                        const container = document.getElementById('perguntas-container');
                        const novaPergunta = document.createElement('div');
                        novaPergunta.innerHTML = '<input type="text" name="perguntas[]" class="form-control mb-2" required />';
                        container.appendChild(novaPergunta);
                    }
                </script>
            </div>
        </body>
        </html>`
    );
});

// Processar adição de perguntas e salvar no banco
app.post('/adicionar-perguntas', verificarAdministrador,async (req, res) => {
    const { campanhaId, perguntas } = req.body;
    try {
        for (const pergunta of perguntas) {
            await client.query(
                'INSERT INTO perguntas (campanha_id, pergunta) VALUES ($1, $2)',
                [campanhaId, pergunta]
            );
        }
        res.redirect('/');
    } catch (err) {
        console.error('Erro ao adicionar perguntas:', err);
        res.send('Erro ao adicionar perguntas');
    }
});

// Rota para enviar e-mail de avaliação
app.get('/enviar-avaliacao/:campanhaId', verificarAdministrador, async (req, res) => {
    const campanhaId = req.params.campanhaId;
    try {
        // Buscar campanha
        const campanha = await client.query('SELECT * FROM campanhas WHERE id = $1', [campanhaId]);

        // Buscar setores no banco de dados
        const setores = await client.query('SELECT DISTINCT setor FROM usuarios');

        // Gerar o HTML do select com os setores
        const setoresOptions = setores.rows.map(
            setor => `<option value="${setor.setor}">${setor.setor}</option>`
        ).join('');

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="/">
                    <img fetchpriority="high" decoding="async" width="100px" height="40px"
                    src="https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1.webp" 
                    class="attachment-full size-full wp-image-6626" 
                    alt srcset="https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1.webp 768w, 
                    https://input.com.vc/wp-content/uploads/2024/08/LogoInput-768x314-1-300x123.webp 300w" sizes="(max-width: 768px) 100vw, 768px">
                </a>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav">
                        <li class="nav-item "><a class="nav-link text-white" href="/criar-campanha ">Criar Campanha</a></li>
                        <li class="nav-item"><a class="nav-link text-white" href="/perguntas">Perguntas</a></li>
                    </ul>
                </div>
                <div class="d-flex">
                    <a href="/logout" class="btn btn-danger">Sair</a>
                </div>
            </div>
        </nav>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Enviar Avaliação</title>
                <!-- Bootstrap CSS -->
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body>
                <div class="container mt-5">
                    <div class="row">
                        <div class="col-md-6 offset-md-3">
                            <div class="card">
                                <div class="card-header text-center">
                                    <h3>Enviar Avaliação</h3>
                                </div>
                                <div class="card-body">
                                    <form action="/enviar-avaliacao/${campanhaId}" method="POST">
                                        <div class="mb-3">
                                            <label for="setor" class="form-label">Selecione o setor:</label>
                                            <select name="setor" id="setor" class="form-select" required>
                                                <option value="">Selecione um setor</option>
                                                ${setoresOptions}
                                            </select>
                                        </div>
                                        <button type="submit" class="btn btn-primary w-100 mt-3">Enviar E-mails</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bootstrap JS -->
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>
        `
        );
    } catch (err) {
        console.error('Erro ao carregar setores:', err);
        res.send('Erro ao carregar setores');
    }
});

// Processar envio de e-mail de avaliação
// Processar envio de e-mails de avaliação para o setor selecionado
app.post('/enviar-avaliacao/:campanhaId', verificarAdministrador, async (req, res) => {
    const campanhaId = req.params.campanhaId;
    const { setor } = req.body;

    if (!setor) {
        return res.send('Por favor, selecione um setor.');
    }

    try {
        // Buscar campanha
        const campanha = await client.query('SELECT * FROM campanhas WHERE id = $1', [campanhaId]);

        // Buscar usuários do setor selecionado
        const usuarios = await client.query('SELECT email FROM usuarios WHERE setor = $1', [setor]);

        if (usuarios.rows.length === 0) {
            return res.send('Nenhum usuário encontrado para o setor selecionado.');
        }

        // Gerar o link para responder as perguntas
        const responderLink = `http://localhost:${port}/responder/${campanhaId}`;

        // Enviar e-mails para todos os usuários do setor
        for (const usuario of usuarios.rows) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: usuario.email,
                subject: `Avaliação - ${campanha.rows[0].titulo}`,
                html: `
                    <h4>Por favor, responda as perguntas desta campanha clicando no link abaixo:</h4>
                    <a href="${responderLink}" class="btn btn-primary">Responder Avaliação</a>
                `,
            };

            await transporter.sendMail(mailOptions);
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sucesso</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body>
                <div class="container mt-5">
                    <div class="alert alert-success text-center">
                        <h4>Sucesso!</h4>
                        <p>Os e-mails foram enviados com sucesso para o setor: <strong>${setor}</strong>.</p>
                        <a href="/dashboard-admin" class="btn btn-primary mt-3">Voltar para o Dashboard</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Erro ao enviar e-mails:', err);
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Erro</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body>
                <div class="container mt-5">
                    <div class="alert alert-danger text-center">
                        <h4>Erro!</h4>
                        <p>Houve um problema ao enviar os e-mails. Por favor, tente novamente.</p>
                        <a href="/dashboard-admin" class="btn btn-primary mt-3">Voltar para o Dashboard</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    }
});


// Rota para exibir as perguntas da campanha para o usuário responder
// Rota para exibir as perguntas da campanha para o usuário responder
app.get('/responder/:campanhaId', async (req, res) => {
    const campanhaId = req.params.campanhaId;

    // Verifica se o usuário está logado e é do tipo 'usuario'
    if (!req.session.usuarioId || req.session.tipoUsuario !== 'usuario') {
        // Salvar o ID da campanha na sessão antes de redirecionar para o login
        req.session.campanhaRedirect = campanhaId;
        return res.redirect(`/usuario-login`);
    }

    try {
        const campanha = await client.query('SELECT * FROM campanhas WHERE id = $1', [campanhaId]);
        const perguntas = await client.query('SELECT * FROM perguntas WHERE campanha_id = $1', [campanhaId]);

        res.send(`
            <html>
            <head>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet" />
            </head>
            <body>
                <div class="container mt-4">
                    <h1>Responda as Perguntas da Campanha: ${campanha.rows[0].titulo}</h1>
                    <form action="/salvar-respostas/${campanhaId}" method="POST">
                        <!-- Adicionando campo escondido para usuario_id -->
                        <input type="hidden" name="usuario_id" value="${req.session.usuarioId}" />
                        ${perguntas.rows.map(p => `
                            <div class="form-group mb-3">
                                <label>${p.pergunta}</label><br>
                                <input type="radio" name="resposta-${p.id}" value="1" required> 1
                                <input type="radio" name="resposta-${p.id}" value="2"> 2
                                <input type="radio" name="resposta-${p.id}" value="3"> 3
                                <input type="radio" name="resposta-${p.id}" value="4"> 4
                                <input type="radio" name="resposta-${p.id}" value="5"> 5
                            </div>
                        `).join('')}
                        <button type="submit" class="btn btn-success">Enviar Respostas</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Erro ao carregar perguntas:', err);
        res.send('Erro ao carregar perguntas');
    }
});


// Rota para salvar as respostas do usuário
app.post('/salvar-respostas/:campanhaId', async (req, res) => {
    const campanhaId = req.params.campanhaId;
    const usuarioId = req.body.usuario_id; // Captura o usuario_id enviado no formulário
    const respostas = req.body;

    if (!usuarioId) {
        return res.status(400).send('Usuário não autenticado');
    }

    try {
        // Inserir as respostas no banco, incluindo o usuarioId
        for (const [perguntaId, resposta] of Object.entries(respostas)) {
            // Não salvar o campo "usuario_id" que veio de respostas[perguntaId], pois ele não é uma pergunta
            if (!perguntaId.includes('usuario_id')) {
                await client.query(
                    'INSERT INTO respostas (campanha_id, pergunta_id, usuario_id, resposta) VALUES ($1, $2, $3, $4)',
                    [campanhaId, perguntaId.split('-')[1], usuarioId, resposta]
                );
            }
        }

        res.send('Respostas enviadas com sucesso!');
    } catch (err) {
        console.error('Erro ao salvar respostas:', err);
        res.send('Erro ao salvar respostas');
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});