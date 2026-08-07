// ======================================================
// SAFE
// Arquivo: testesInfo.js
//
// Informação de apoio de cada um dos 9 testes — usada tanto
// no ícone pequeno de ajuda (testeInfoUI.js) quanto no botão
// "Como executar este teste" das telas de avaliação. Escrito
// com nossas próprias palavras (não é cópia do texto do
// manual).
//
// As imagens ficam em assets/teste-<chave>.png. Pra trocar
// a ilustração de um teste, basta substituir o arquivo
// mantendo o mesmo nome — não precisa mexer em código.
// Testes sem imagem ainda simplesmente não mostram o ícone.
//
// Campos novos (usados no botão "Como Executar"):
// cor: cor exclusiva do teste, usada no cabeçalho da tela
// unidade: unidade de medida do resultado
// materiais: lista de materiais necessários
// criteriosExecucao: como o teste deve ser feito
// criteriosValidacao: o que torna uma tentativa válida
// errosComuns: erros que invalidam ou distorcem o resultado
// formaRegistrar: o que exatamente anotar como resultado
// video: por enquanto sempre null (nenhum vídeo hospedado
// ainda — campo já preparado pra quando houver um link)
// ======================================================

export const TESTES_INFO = {

    leger: {
        titulo: "Léger (Funcionários)",
        imagem: "assets/teste-leger.png",
        descricao: "Corrida de vai-e-vem numa distância de 20 metros, no ritmo de sinais sonoros que aumentam de velocidade a cada estágio. O funcionário precisa tocar a linha oposta a cada sinal; quando não conseguir mais acompanhar o ritmo por duas vezes seguidas, o teste termina. Estima a capacidade cardiorrespiratória (VO₂máx). Aplicado só aos funcionários adultos da escola — não faz parte da bateria PROESP-Br dos alunos.",
        cor: "#2563EB",
        unidade: "estágio / VO₂máx",
        video: null,
        materiais: ["Espaço plano de 20 metros", "Cones ou fita marcando as duas linhas", "Áudio do teste de Léger (sinais sonoros)", "Caneta e planilha (ou celular) pra marcar o estágio"],
        criteriosExecucao: ["Funcionário começa atrás de uma das linhas", "A cada sinal sonoro, precisa tocar a linha oposta com um dos pés", "O ritmo aumenta a cada estágio (fica mais rápido)"],
        criteriosValidacao: ["Conta só o último estágio completo alcançado", "Teste termina quando o funcionário não toca a linha a tempo por 2 vezes seguidas"],
        errosComuns: ["Deixar o funcionário adiantar o toque antes do sinal (torna o resultado artificialmente maior)", "Não anotar o estágio E o número de tiros dentro do estágio", "Confundir 1ª falha isolada com o encerramento (só encerra na 2ª falha seguida)"],
        formaRegistrar: "Anote o último estágio completo e, se possível, quantos tiros dentro dele o funcionário completou. O sistema calcula o VO₂máx automaticamente a partir disso."
    },

    antropometriaAdulto: {
        titulo: "Antropometria Adulta",
        imagem: "assets/teste-circunferenciacintura.png",
        descricao: "Medição de peso, estatura, circunferência da cintura e 4 dobras cutâneas (subescapular, tríceps, supra-ilíaca e panturrilha medial) de um funcionário adulto da escola. O sistema calcula automaticamente o IMC (classificação da OMS), a Razão Cintura-Estatura (RCE) e o percentual de gordura corporal (protocolo de Petroski).",
        cor: "#0891B2",
        unidade: "kg / cm / mm",
        video: null,
        materiais: ["Balança calibrada", "Estadiômetro ou fita métrica fixada na parede", "Fita métrica flexível (cintura)", "Adipômetro (compasso de dobras cutâneas)"],
        criteriosExecucao: ["Funcionário descalço, com roupas leves", "Cintura medida no ponto médio entre a última costela e a crista ilíaca", "Dobras cutâneas medidas do lado direito do corpo, sempre no mesmo ponto anatômico"],
        criteriosValidacao: ["Repetir a medida da dobra se os valores de duas leituras variarem muito", "Balança zerada antes de cada funcionário"],
        errosComuns: ["Medir a cintura na altura do umbigo em vez do ponto médio anatômico correto", "Apertar demais o adipômetro na dobra, comprimindo o tecido", "Confundir o lado do corpo medido (deve ser sempre o direito)"],
        formaRegistrar: "Registre peso (kg), estatura (cm), cintura (cm) e as 4 dobras cutâneas (mm) com uma casa decimal. O sistema calcula IMC, RCE e % de gordura automaticamente."
    },

    circunferenciacintura: {
        titulo: "Perímetro da Cintura (RCE)",
        imagem: "assets/teste-circunferenciacintura.png",
        descricao: "Medição da circunferência da cintura (no ponto médio entre a última costela e a crista ilíaca) e da estatura, usadas para calcular a Razão Cintura-Estatura (RCE) — um indicador de gordura concentrada na região abdominal, associado a risco cardiovascular.",
        cor: "#0891B2",
        unidade: "cm (cintura e estatura)",
        video: null,
        materiais: ["Fita métrica flexível, com resolução de 1mm", "Local reservado (a medida é feita com a barra da roupa levantada)"],
        criteriosExecucao: ["Aluno em pé, abdômen relaxado (sem prender a respiração)", "Medida no ponto médio entre a borda inferior da última costela e a borda superior da crista ilíaca (osso do quadril)", "Fita métrica na horizontal, ajustada sem apertar a pele"],
        criteriosValidacao: ["Fazer a leitura ao final de uma expiração normal", "Repetir a medida se a fita estiver torta ou frouxa demais"],
        errosComuns: ["Medir na altura do umbigo em vez do ponto médio anatômico correto", "Apertar demais a fita, comprimindo a pele", "Medir por cima de roupa grossa"],
        formaRegistrar: "Registre a circunferência da cintura e a estatura, ambas em centímetros com uma casa decimal. O sistema calcula a Razão Cintura-Estatura (RCE) e a classificação automaticamente."
    },

    imc: {
        titulo: "IMC",
        imagem: "assets/teste-imc.png",
        descricao: "Medição do peso corporal (kg) e da estatura (cm), com o aluno descalço e em postura ereta. O índice é calculado dividindo o peso pela estatura ao quadrado, indicando a relação entre massa corporal e altura.",
        cor: "#DC2626",
        unidade: "kg / cm",
        video: null,
        materiais: ["Balança calibrada", "Estadiômetro ou fita métrica fixada na parede", "Local privado ou reservado (o aluno tira o calçado)"],
        criteriosExecucao: ["Aluno descalço, com roupas leves", "Postura ereta, olhando pra frente, calcanhares juntos encostados na parede/estadiômetro", "Peso medido em pé, parado, sem se apoiar em nada"],
        criteriosValidacao: ["Medir estatura no momento da inspiração (leve elevação do queixo, sem forçar)", "Balança zerada antes de cada aluno"],
        errosComuns: ["Medir com o aluno de calçado ou com roupa pesada (casaco, moletom)", "Deixar o aluno curvado ou na ponta dos pés na hora da estatura", "Registrar peso/estatura em unidades trocadas (ex: metros em vez de cm)"],
        formaRegistrar: "Registre peso em quilogramas (com casas decimais, ex: 42.5) e estatura em centímetros (ex: 148.0). O sistema calcula o IMC automaticamente."
    },

    flexibilidade: {
        titulo: "Flexibilidade (Sentar e Alcançar)",
        imagem: "assets/teste-flexibilidade.png",
        descricao: "Sentado no chão, pernas estendidas e unidas, o aluno inclina o tronco à frente com as mãos sobrepostas, alcançando a maior distância possível sobre uma fita métrica fixada no chão. Mede a flexibilidade da musculatura posterior do tronco e das pernas.",
        cor: "#16A34A",
        unidade: "cm",
        video: null,
        materiais: ["Fita métrica fixada no chão (ou banco de Wells)", "Espaço plano"],
        criteriosExecucao: ["Aluno sentado, pernas estendidas, pés apoiados na base da fita/banco", "Mãos sobrepostas, uma sobre a outra", "Inclina o tronco à frente devagar, sem impulso, mantendo os joelhos estendidos"],
        criteriosValidacao: ["Vale a maior distância alcançada e mantida por ao menos 1-2 segundos", "Geralmente melhor de 2-3 tentativas"],
        errosComuns: ["Permitir flexionar os joelhos durante o alcance (invalida a tentativa)", "Deixar o aluno usar impulso/balanço em vez de alongamento controlado", "Medir a partir do ponto errado da fita"],
        formaRegistrar: "Registre a distância em centímetros alcançada na melhor tentativa (pode ser negativa, se o aluno não alcançar a base da fita)."
    },

    abdominal: {
        titulo: "Resistência Muscular Localizada (Abdominal)",
        imagem: "assets/teste-abdominal.png",
        descricao: "Deitado de barriga para cima, joelhos flexionados a 45° e braços cruzados sobre o tórax, com o avaliador segurando os tornozelos do aluno. Ao sinal, o aluno faz o maior número de flexões de tronco possível em 1 minuto, tocando os cotovelos nas coxas a cada repetição.",
        cor: "#F59E0B",
        unidade: "repetições",
        video: null,
        materiais: ["Colchonete ou superfície macia", "Cronômetro", "Um avaliador pra segurar os tornozelos"],
        criteriosExecucao: ["Deitado, joelhos flexionados a aproximadamente 45°, pés apoiados no chão", "Braços cruzados sobre o peito, mãos nos ombros opostos", "Sobe o tronco até os cotovelos tocarem as coxas, depois volta a encostar as costas no chão"],
        criteriosValidacao: ["Só conta a repetição se o movimento completo (subida + descida) for feito corretamente", "Tempo total: exatamente 1 minuto"],
        errosComuns: ["Deixar as mãos saírem dos ombros (usar impulso dos braços)", "Não exigir que as costas encostem completamente no chão entre repetições", "Cronometrar errado (mais ou menos que 60 segundos)"],
        formaRegistrar: "Registre o número total de repetições completas e válidas feitas em 1 minuto."
    },

    medicineball: {
        titulo: "Potência de Membros Superiores (Medicine Ball)",
        imagem: "assets/teste-medicineball.png",
        descricao: "Sentado com as costas apoiadas na parede, pernas estendidas e unidas, o aluno segura a bola de 2kg junto ao peito e a arremessa à frente com as duas mãos, o mais longe possível, mantendo as costas na parede. Mede a distância entre o ponto de partida e onde a bola toca o solo.",
        cor: "#7C3AED",
        unidade: "cm",
        video: null,
        materiais: ["Bola medicinal (medicine ball) de 2kg", "Parede lisa", "Fita métrica ou trena longa", "Espaço livre de pelo menos 6 metros à frente"],
        criteriosExecucao: ["Sentado no chão, costas e cabeça encostadas na parede", "Pernas estendidas e unidas à frente", "Bola junto ao peito, arremesso com as duas mãos ao mesmo tempo, à frente"],
        criteriosValidacao: ["As costas precisam permanecer encostadas na parede até a bola sair das mãos", "Vale a maior distância entre 2-3 tentativas"],
        errosComuns: ["Deixar o aluno tirar as costas da parede antes do arremesso (ganha impulso extra, invalida)", "Arremessar com um braço só ou empurrando de lado", "Medir a partir do ponto errado (deve ser de onde a bola toca o chão até a parede)"],
        formaRegistrar: "Registre a maior distância (em cm) entre a parede e o ponto onde a bola tocou o solo pela primeira vez, entre as tentativas realizadas."
    },

    saltohorizontal: {
        titulo: "Potência de Membros Inferiores (Salto Horizontal)",
        imagem: "assets/teste-saltohorizontal.png",
        descricao: "Em pé, atrás de uma linha de partida, com os pés paralelos e joelhos semiflexionados, o aluno salta à frente o mais longe possível, aterrissando com os dois pés juntos. Mede a distância entre a linha de partida e o calcanhar mais próximo dela.",
        cor: "#DB2777",
        unidade: "cm",
        video: null,
        materiais: ["Fita métrica ou trena fixada no chão", "Colchonete ou área de aterrissagem macia (opcional)", "Linha de partida bem marcada"],
        criteriosExecucao: ["Pés paralelos, atrás da linha, joelhos semiflexionados", "Balanço de braços permitido antes do salto", "Aterrissagem com os dois pés ao mesmo tempo"],
        criteriosValidacao: ["Vale a maior distância entre 2-3 tentativas", "A tentativa só é válida se o aluno não cair pra trás na aterrissagem"],
        errosComuns: ["Deixar o aluno pisar/ultrapassar a linha antes do salto (impulso extra)", "Medir a partir do pé mais distante em vez do mais próximo da linha", "Contar tentativa em que o aluno caiu sentado/pra trás"],
        formaRegistrar: "Registre a distância em centímetros entre a linha de partida e o calcanhar mais próximo dela na aterrissagem, na melhor tentativa."
    },

    agilidade: {
        titulo: "Agilidade (Quadrado 4x4m)",
        imagem: "assets/teste-agilidade.png",
        descricao: "Quatro marcos dispostos formando um quadrado de 4 metros de lado. O aluno percorre o trajeto tocando os quatro pontos na maior velocidade possível (diagonal, lateral, diagonal, retorno), cronometrado do primeiro ao último toque.",
        cor: "#0D9488",
        unidade: "segundos",
        video: null,
        materiais: ["4 cones ou marcadores", "Trena (quadrado de 4m de lado)", "Cronômetro"],
        criteriosExecucao: ["Aluno começa num dos cantos do quadrado", "Percorre o trajeto tocando os 4 cantos na sequência correta (geralmente diagonal-lateral-diagonal-retorno)", "Máxima velocidade do início ao fim"],
        criteriosValidacao: ["Cronômetro dispara no primeiro movimento e para no toque final do último cone", "Vale o menor tempo entre 2 tentativas, se aplicado mais de uma vez"],
        errosComuns: ["Errar a ordem dos cones (precisa refazer)", "Cronometrar com atraso na largada ou na chegada", "Cones fora da distância exata de 4m entre si"],
        formaRegistrar: "Registre o tempo total em segundos (com casas decimais, ex: 12.4), do início ao toque do último cone."
    },

    corrida20m: {
        titulo: "Velocidade (Corrida 20m)",
        imagem: "assets/teste-corrida20m.png",
        descricao: "Corrida em linha reta de 20 metros, na maior velocidade possível, com o tempo cronometrado desde o início do movimento até a passagem pela linha de chegada.",
        cor: "#EA580C",
        unidade: "segundos",
        video: null,
        materiais: ["Espaço reto de pelo menos 25-30 metros (20m + margem de desaceleração)", "Cronômetro (ou 2 cronometristas)", "Marcação de largada e chegada"],
        criteriosExecucao: ["Largada parada, um pé à frente do outro, atrás da linha", "Corrida em máxima velocidade pelos 20 metros", "Sem desacelerar antes da linha de chegada"],
        criteriosValidacao: ["Cronômetro dispara no primeiro movimento do aluno, não no sinal do avaliador", "Vale o menor tempo entre 2 tentativas, se aplicado mais de uma vez"],
        errosComuns: ["Cronometrar a partir do sinal de 'vai' em vez do movimento real do aluno (perde precisão)", "Aluno desacelerando antes da linha por achar que já terminou", "Pista com piso escorregadio ou irregular"],
        formaRegistrar: "Registre o tempo total em segundos (com casas decimais, ex: 4.25), do início do movimento até a passagem pela linha dos 20m."
    },

    corrida6min: {
        titulo: "Aptidão Cardiorrespiratória (Corrida/Caminhada 6min)",
        imagem: "assets/teste-corrida6min.png",
        descricao: "Numa pista com o perímetro demarcado, o aluno corre ou caminha o máximo possível durante 6 minutos seguidos, sem parar. Ao final do tempo, registra-se a distância total percorrida.",
        cor: "#4338CA",
        unidade: "metros",
        video: null,
        materiais: ["Pista ou percurso com perímetro conhecido e demarcado (ex: quadra, pátio)", "Cronômetro", "Forma de contar voltas (marcador, planilha, ou um auxiliar por aluno/grupo)"],
        criteriosExecucao: ["Aluno pode correr, trotar ou caminhar — o importante é não parar", "Percorre o máximo de distância possível dentro dos 6 minutos"],
        criteriosValidacao: ["Conta-se a distância total (voltas completas + fração da última volta, se possível estimar)", "Teste vale mesmo que o aluno alterne ritmo, desde que continue se movendo"],
        errosComuns: ["Perder a contagem de voltas em turmas grandes (usar planilha ou marcador por aluno ajuda)", "Não demarcar bem o perímetro, gerando distância imprecisa", "Permitir paradas longas sem registrar isso na avaliação"],
        formaRegistrar: "Registre a distância total percorrida em metros ao final dos 6 minutos (voltas completas × perímetro da pista, mais a fração percorrida na última volta incompleta)."
    }

};