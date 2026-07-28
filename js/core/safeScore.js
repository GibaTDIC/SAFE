// ======================================================
// SAFE
// Arquivo: safeScore.js
//
// Sistema central do SAFE Score — um indicador único de
// desempenho motor, de 0 a 100, com 4 faixas fixas e cores
// padronizadas em toda a plataforma (dashboards, rankings,
// pop-ups). Qualquer tela que precise classificar uma nota
// 0-100 deve importar e usar isso, em vez de inventar sua
// própria escala de cor.
// ======================================================

export const FAIXAS_SAFE_SCORE = [

    { min:0,  max:25,  label:"Risco",      cor:"#DC2626", corFundo:"#FEE2E2", emoji:"🔴" },
    { min:26, max:50,  label:"Atenção",     cor:"#F59E0B", corFundo:"#FEF3C7", emoji:"🟠" },
    { min:51, max:75,  label:"Saudável",    cor:"#16A34A", corFundo:"#DCFCE7", emoji:"🟢" },
    { min:76, max:100, label:"Excelência",  cor:"#2563EB", corFundo:"#DBEAFE", emoji:"🔵" }

];

// Devolve a faixa (objeto acima) correspondente a uma nota 0-100.
// Se a nota vier nula/indefinida, devolve null (sem avaliação).
export function classificarSafeScore(nota){

    if(nota === null || nota === undefined || isNaN(nota)){

        return null;

    }

    const notaLimitada = Math.max(0, Math.min(100, nota));

    return FAIXAS_SAFE_SCORE.find(f => notaLimitada >= f.min && notaLimitada <= f.max)

        || FAIXAS_SAFE_SCORE[FAIXAS_SAFE_SCORE.length - 1];

}

// Atalho pra pegar só a cor (usado em texto/borda/gráfico)
export function corSafeScore(nota){

    return classificarSafeScore(nota)?.cor || "#94a3b8";

}

// Atalho pra pegar o rótulo com emoji (ex: "71 🟢 Saudável")
export function rotuloSafeScore(nota){

    const faixa = classificarSafeScore(nota);

    if(!faixa){

        return "Sem avaliação";

    }

    return `${Math.round(nota)} ${faixa.emoji} ${faixa.label}`;

}
