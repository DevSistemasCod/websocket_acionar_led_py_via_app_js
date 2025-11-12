// @ts-nocheck

let estadoLedAceso = false;

function configurar() {
  const elementos = inicializarElementos();
  if (!elementos) {
    return;
  }

  const { botaoLed, elementoStatus } = elementos;
  // a linha anterior é uma simplificação ela é o mesmo que escrever
  // const botaoLed = elementos.botaoLed;
  // const elementoStatus = elementos.elementoStatus;

  // Define o estado inicial da interface
  atualizarInterface('Desconectado', 'red', null, botaoLed, elementoStatus);

  // Inicia a conexão WebSocket
  const socket = conectarAoESP32(botaoLed, elementoStatus);

  // Configura o evento de clique no botão
  configurarEventos(botaoLed, socket, elementoStatus);
}

// obtemos os elmentos do DOM
function inicializarElementos() {
  try {
    const botaoLed = document.getElementById('ledBtn');
    const elementoStatus = document.getElementById('status');

    // prettier-ignore
    if (!(botaoLed instanceof HTMLButtonElement) || !(elementoStatus instanceof HTMLSpanElement)) {
      throw new Error('Elementos do DOM não encontrados ou incorretos.');
    }

    return { botaoLed, elementoStatus };
    // return { botaoLed: botaoLed, elementoStatus: elementoStatus };
  } catch (erro) {
    console.error('Erro ao inicializar elementos:', erro);
    return null;
  }
}

function configurarEventos(botaoLed, socket, elementoStatus) {
  botaoLed.addEventListener('click', () => {
    alternarLed(socket, botaoLed, elementoStatus);
  });
}

function conectarAoESP32(botaoLed, elementoStatus) {
  const socket = criarConexaoWebSocket();
  registrarEventosWebSocket(socket, botaoLed, elementoStatus);
  return socket;
}

function criarConexaoWebSocket() {
  const ipESP32 = '10.110.22.8'; // endereço do ESP32
  const porta = '8765';
  const url = `ws://${ipESP32}:${porta}`;
  console.log(`Tentando conectar a ${url}...`);

  return new WebSocket(url);
}

function registrarEventosWebSocket(socket, botaoLed, elementoStatus) {
  socket.onopen = () => aoConectar(socket, botaoLed, elementoStatus);
  socket.onmessage = (evento) =>
    aoReceberMensagem(evento, socket, botaoLed, elementoStatus);
  socket.onerror = (erro) =>
    aoOcorrerErro(erro, socket, botaoLed, elementoStatus);
  socket.onclose = (evento) =>
    aoDesconectar(evento, socket, botaoLed, elementoStatus);
}

function aoConectar(socket, botaoLed, elementoStatus) {
  console.log('Conectado ao ESP32');
  // prettier-ignore
  atualizarInterface('Conectado ao ESP32', 'green', socket, botaoLed, elementoStatus);

  // Pede o estado atual do LED
  socket.send('STATUS');
}

function aoReceberMensagem(evento, socket, botaoLed, elementoStatus) {
  const mensagem = evento.data.trim();
  console.log('Recebido do ESP32:', mensagem);

  processarMensagemRecebida(mensagem, socket, botaoLed, elementoStatus);
}

function aoOcorrerErro(erro, socket, botaoLed, elementoStatus) {
  console.error(' Erro na conexão WebSocket:', erro);
  // prettier-ignore
  atualizarInterface('Erro na conexão','orange', socket, botaoLed, elementoStatus);
}

function aoDesconectar(evento, socket, botaoLed, elementoStatus) {
  //é executada quando o WebSocket é fechado — ou seja, quando o evento onclose
  console.warn('Conexão fechada:', evento.code, 'Razão:', evento.reason);
  /*
  evento.code: é um número que indica o motivo técnico do fechamento, 
  conforme o padrão WebSocket.
    por exemplo
    1000: fechamento normal (sem erro).
    1006: conexão encerrada de forma anormal (ex: perda de rede).
    1001: servidor foi desligado ou saiu.
    1011: erro interno no servidor.

    evento.reason: é uma mensagem de texto opcional, enviada pelo 
    servidor WebSocket, explicando o motivo do fechamento.
  */

  // prettier-ignore
  atualizarInterface('Desconectado. Recarregue a página.','red',socket,botaoLed, elementoStatus);
}

function alternarLed(socket, botaoLed, elementoStatus) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    // prettier-ignore
    atualizarInterface('Conexão não está aberta','red', socket, botaoLed, elementoStatus);
    return;
  }

  // variável que vai guardar o texto do comando
  let comando;
  // verifica o estado atual do LED
  if (estadoLedAceso) {
    comando = 'OFF';
  } else {
    comando = 'ON';
  }
  console.log(` Enviando comando: ${comando}`);
  socket.send(comando);
}

function processarMensagemRecebida(mensagem, socket, botaoLed, elementoStatus) {
  // prettier-ignore
  if (mensagem.includes('LED ligado')) {
    estadoLedAceso = true;
  }  
  else if (mensagem.includes('LED desligado')){ 
    estadoLedAceso = false;
  }
  let cor; // variável que vai guardar a cor da mensagem

  // verifica se a mensagem contém a palavra "Erro:"
  if (mensagem.includes('Erro:')) {
    cor = 'orange'; //caso verdadeiro
  } else {
    cor = 'green'; //caso falso
  }

  atualizarInterface(mensagem, cor, socket, botaoLed, elementoStatus);
}

function atualizarInterface(mensagem, cor, socket, botaoLed, elementoStatus) {
  if (mensagem) elementoStatus.innerText = mensagem;
  if (cor) elementoStatus.style.color = cor;

  botaoLed.innerText = estadoLedAceso ? 'ON' : 'OFF';
  /* o ternário acima pode ser feito com if else a seguir
  if (estadoLedAceso) {
  botaoLed.innerText = 'ON';
  } else {
  botaoLed.innerText = 'OFF';
  }*/

  // método .classList.toggle(), que serve pra ligar ou desligar
  // uma classe CSS em um elemento.
  //.toggle('on', estadoLedAceso) quer dizer:
  // se estadoLedAceso for true, adiciona a classe 'on';
  botaoLed.classList.toggle('on', estadoLedAceso);
  // se o LED não estiver aceso (!estadoLedAceso é true), adiciona a classe 'off';
  botaoLed.classList.toggle('off', !estadoLedAceso);

  // desativa botão se desconectado
  const conectado = socket && socket.readyState === WebSocket.OPEN;
  /* Observação 
  socket.readyState indica o estado atual da conexão WebSocket.
  É um número (de 0 a 3) que muda conforme a conexão avança.
  Valor numérico	Constante	              Significado
      0	          WebSocket.CONNECTING	  A conexão está sendo estabelecida
      1	          WebSocket.OPEN	        Conexão aberta — pode enviar e receber mensagens
      2	          WebSocket.CLOSING	      Conexão sendo encerrada
      3	          WebSocket.CLOSED	      Conexão fechada — não é mais possível usar
  */

  // Desativa o botão (disabled = true) se não estiver conectado,
  // e ativa (disabled = false) se estiver conectado.
  botaoLed.disabled = !conectado;
}

document.addEventListener('DOMContentLoaded', configurar);
