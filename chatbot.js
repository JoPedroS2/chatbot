// ===============================
// Importações
// ===============================
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

// ===============================
// Configurações de sessão
// ===============================
const SESSIONS_FILE = './sessions.json';
const TEMPO_EXPIRACAO = 5 * 60 * 60 * 1000; // 5 horas
const userSessions = {};

// ===============================
// Salvar sessões no disco
// ===============================
function salvarSessoes() {
    const cleanSessions = {};
    for (const [numero, sessao] of Object.entries(userSessions)) {
        cleanSessions[numero] = {
            etapa: sessao.etapa,
            finalizado: sessao.finalizado,
            ultima: sessao.ultima
        };
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(cleanSessions, null, 2));
}

// ===============================
// Carregar sessões salvas
// ===============================
function carregarSessoes() {
    if (fs.existsSync(SESSIONS_FILE)) {
        const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        const saved = JSON.parse(data);
        for (const [numero, sessao] of Object.entries(saved)) {
            userSessions[numero] = {
                ...sessao,
                timeout: setTimeout(() => encerrarSessao({ from: numero }, sessao.etapa), TEMPO_EXPIRACAO)
            };
        }
    }
}

// ===============================
// Inicialização do Client
// ===============================
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "joaoviagens",
        dataPath: "./sessao-whatsapp"
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// ===============================
// QR Code
// ===============================
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// ===============================
// Bot pronto
// ===============================
client.on('ready', () => {
    console.log('✅ Bot conectado ao WhatsApp com sucesso!');
});

// ===============================
// Inicializa o client
// ===============================
client.initialize();
carregarSessoes();

// ===============================
// Funções auxiliares
// ===============================
const delay = ms => new Promise(res => setTimeout(res, ms));

// Encerrar sessão
const encerrarSessao = async (msg, funilAtual) => {
    if (!userSessions[msg.from]) return;
    await client.sendMessage(msg.from, "⏳ Sessão encerrada. Até logo!");
    clearTimeout(userSessions[msg.from].timeout);
    delete userSessions[msg.from];
    salvarSessoes();

    if (funilAtual !== "instagram") {
        await delay(500);
        await client.sendMessage(msg.from,
            "💡 Aproveite para me seguir no Instagram e ficar por dentro de todas as promoções e viagens! ✈️\nhttps://www.instagram.com/joaoviagensacre/");
    }
};

// Menu principal
const enviarMenu = async (msg, name) => {
    const chat = await msg.getChat();
    const textoMenu =
`🌟 *Olá ${name}! Sou seu assistente virtual* 🌟

Como posso ajudá-lo hoje? Escolha uma das opções abaixo digitando o número correspondente:

1️⃣ *Fazer Cotação*  
2️⃣ *Check-in*  
3️⃣ *Entrar no Grupo de Promoções*  
4️⃣ *Meu Instagram*  

💡 Responda com o número da opção desejada.`;

    await chat.sendStateTyping();
    await delay(500);
    await client.sendMessage(msg.from, textoMenu);

    if (userSessions[msg.from] && userSessions[msg.from].timeout) {
        clearTimeout(userSessions[msg.from].timeout);
    }
    userSessions[msg.from].timeout = setTimeout(() => encerrarSessao(msg, "menu"), TEMPO_EXPIRACAO);
    salvarSessoes();
};

// ===============================
// Funil de mensagens
// ===============================
const funil = async (msg) => {
    if (!msg.from.endsWith('@c.us')) return;

    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const name = contact.pushname ? contact.pushname.split(" ")[0] : "Olá";

    const agora = Date.now();
    const sessao = userSessions[msg.from] || {};
    const expirou = !sessao.ultima || (agora - sessao.ultima) > TEMPO_EXPIRACAO;

    if (expirou) {
        userSessions[msg.from] = { etapa: "menu", ultima: agora, finalizado: false };
        await enviarMenu(msg, name);
        return;
    }

    userSessions[msg.from].ultima = agora;
    if (userSessions[msg.from].timeout) clearTimeout(userSessions[msg.from].timeout);
    userSessions[msg.from].timeout = setTimeout(() => encerrarSessao(msg, sessao.etapa), TEMPO_EXPIRACAO);

    const etapa = sessao.etapa || "menu";
    const finalizado = sessao.finalizado || false;

    if (etapa === "menu") {
        switch(msg.body) {
            case '1': 
                userSessions[msg.from].etapa = "cotacao";
                userSessions[msg.from].finalizado = false;
                await delay(1000);
                await chat.sendStateTyping();
                await client.sendMessage(msg.from,
                    "Certo, me diz aqui o *destino* e o *mês* da sua viagem ✈️\nCaso for ida e volta me diz quantos dias quer ficar lá!\n\n0️⃣ Voltar ao menu");
                break;

            case '2': 
                userSessions[msg.from].etapa = "checkin";
                userSessions[msg.from].finalizado = false;
                await delay(1000);
                await chat.sendStateTyping();
                await client.sendMessage(msg.from,
                    "Certo, me manda aqui a foto da sua *Passagem ou PDF*, lembrando que o check-in libera 2 dias antes da viagem contando a hora da chegada!\n\n0️⃣ Voltar ao menu");
                break;

            case '3': 
                userSessions[msg.from].etapa = "grupo";
                userSessions[msg.from].finalizado = true;
                await delay(2000);
                await chat.sendStateTyping();
                await client.sendMessage(msg.from,
                    "Só clicar no link abaixo e aproveitar as melhores promoções saindo de Rio Branco ⬇️:");
                await delay(1000);
                await client.sendMessage(msg.from,
                    "https://chat.whatsapp.com/Isaf7wNYC54JSstmGKbbi1\n\n0️⃣ Voltar ao menu");
                break;

            case '4': 
                userSessions[msg.from].etapa = "instagram";
                userSessions[msg.from].finalizado = true;
                await delay(2000);
                await chat.sendStateTyping();
                await client.sendMessage(msg.from,
                    "Segue meu instagram e me segue lá! Sempre posto conteúdos sobre viagens e promoções ✈️");
                await delay(1000);
                await chat.sendStateTyping();
                await client.sendMessage(msg.from,
                    "https://www.instagram.com/joaoviagensacre/\n\n0️⃣ Voltar ao menu");
                break;
        }
    } else {
        if (msg.body === '0') {
            userSessions[msg.from].etapa = "menu";
            userSessions[msg.from].finalizado = false;
            await enviarMenu(msg, name);
        } else if (!finalizado) {
            switch(etapa) {
                case "cotacao":
                    userSessions[msg.from].finalizado = true;
                    await delay(1000);
                    await chat.sendStateTyping();
                    await client.sendMessage(msg.from,
                        "Blz, já estou chamando o agente de viagem pra mandar sua cotação! Por favor aguarde.");
                    break;

                case "checkin":
                    if (msg.hasMedia) {
                        const media = await msg.downloadMedia();
                        if (msg.type === 'image' || (msg.type === 'document' && (media.mimetype.includes('pdf') || msg.filename.toLowerCase().endsWith('.pdf')))) {
                            sessao.finalizado = true;
                            await delay(1000);
                            await chat.sendStateTyping();
                            await client.sendMessage(msg.from,
                                "Ok, já estou chamando o agente de viagem pra fazer seu check-in! Por favor aguarde.");
                        }
                    }
                    break;
            }
        }
    }
    salvarSessoes();
};

// ===============================
// Listener principal
// ===============================
client.on('message', async msg => funil(msg));

// ===============================
// Limpar sessões ao final do dia
// ===============================
const agora = new Date();
const milissegundosAteMeiaNoite = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 0, 0) - agora;
setTimeout(() => {
    for (const numero in userSessions) {
        clearTimeout(userSessions[numero].timeout);
        delete userSessions[numero];
    }
    salvarSessoes();
}, milissegundosAteMeiaNoite);
