import network
import uasyncio as asyncio
from machine import Pin
import webSocket  

led_indicador = Pin(2, Pin.OUT)
led_indicador.value(0)

SSID = "WIFI_IOT_CFP601"
PASSWORD = "iot@senai601"

estado_led = False       
cliente_websocket = None 


def conectar_wifi(nome_rede, senha_rede):
    conexao_wifi = network.WLAN(network.STA_IF)
    conexao_wifi.active(True)
    conexao_wifi.connect(nome_rede, senha_rede)
    print("Conectando à rede Wi-Fi...")
    while not conexao_wifi.isconnected():
        pass
    print("Conectado com IP:", conexao_wifi.ifconfig()[0])


async def inicializar_websocket(conexao_entrada, conexao_saida, endereco=None):
    global cliente_websocket

    informacao_cliente = conexao_saida.get_extra_info('peername')
    print(f"Cliente conectado de {informacao_cliente}")
    if cliente_websocket:
        print("Cliente rejeitado: já existe conexão")
        conexao_saida.close()
        await conexao_saida.wait_closed()
        return None

    if not await webSocket.websocket_handshake(conexao_entrada, conexao_saida):
        print("Handshake falhou")
        conexao_saida.close()
        await conexao_saida.wait_closed()
        return None

    ws = webSocket.Websocket(conexao_entrada, conexao_saida)
    cliente_websocket = ws
    print("Cliente configurado com sucesso")
    return ws

# Função que processa as mensagens recebidas do cliente
async def processar_mensagens(ws):
    global estado_led
    try:
        # loop de polling (verificação contínua):
        # fica "esperando" por mensagens no WebSocket
        while ws.open:
            # pausa o loop por 50 milissegundos durante essa pausa, o event loop
            # "cede o controle" para outras funções rodarem.
            # isso mantém o código não-bloqueante (non-blocking):
            # o servidor continua responsivo.
            # 50 milissegundos é um intervalo pequeno o suficiente para não atrasar respostas
            await asyncio.sleep(0.05)
            try:
                mensagem_recebida = await ws.recv()
            except Exception as e:
                print("Erro ao receber mensagem:", e)
                continue

            if not mensagem_recebida:
                continue  # ignora mensagens vazias

            #converte para maiusculo a strip() remove espaços no início e fim
            mensagem_recebida = mensagem_recebida.strip().upper()
            print("Mensagem recebida:", mensagem_recebida)

            # Alterna LED ou responde ao pedido de status
            if mensagem_recebida == "ON" and not estado_led:
                led_indicador.value(1)
                estado_led = True
                await ws.send("LED ligado")
            elif mensagem_recebida == "OFF" and estado_led:
                led_indicador.value(0)
                estado_led = False
                await ws.send("LED desligado")
            elif mensagem_recebida == "STATUS":
                await ws.send("LED ligado" if estado_led else "LED desligado")
            else:
                await ws.send(f"Erro: Mensagem '{mensagem_recebida}' inválida, use ON, OFF ou STATUS")
                continue
    except Exception as e:
        print("Erro no processamento de mensagens:", e)

# Função que lida com cada cliente WebSocket 
async def tratar_conexao_cliente(conexao_entrada, conexao_saida, endereco=None):
    global cliente_websocket

    ws = await inicializar_websocket(conexao_entrada, conexao_saida, endereco)
    if not ws:
        return  # Sai se setup falhou

    try:
        await processar_mensagens(ws)
    except Exception as e:
        print("Erro na conexão:", e)
    finally:
        ws.close()
        cliente_websocket = None
        conexao_saida.close()
        await conexao_saida.wait_closed()
        print("Cliente desconectado")

# Função principal
async def executar_servidor():
    conectar_wifi(SSID, PASSWORD)

    # Configura o socket do servidor
    endereco = ('0.0.0.0', 8765)
    servidor = await asyncio.start_server(tratar_conexao_cliente, endereco[0], endereco[1])
    print("Servidor WebSocket rodando na porta 8765")

    # Loop para manter o servidor rodando
    try:
        while True:
            await asyncio.sleep(0.1) 
    except KeyboardInterrupt:
        servidor.close()
        await servidor.wait_closed()
        print("Servidor encerrado")


if __name__ == "__main__":
    try:
        asyncio.run(executar_servidor())
    except Exception as e:
        print("Erro no loop principal:", e)
