// Remove as UTs `DEMO-` e tudo ligado a elas (Fase 6, SPEC §9).
// Ainda vazio. Deve apagar apenas dados de UTs `DEMO-`.
async function limparDemo() {
  console.log("seed:demo:limpar: nada a fazer ainda (implementado na Fase 6).");
}

limparDemo().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
