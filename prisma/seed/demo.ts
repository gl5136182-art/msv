// Seed de demonstração: 12 UTs `DEMO-`, ≈150 itens e ≈60 solicitações concluídas (Fase 6, SPEC §9).
// Ainda vazio. Só pode criar dados em UTs `DEMO-`, nunca tocar nos dados reais.
async function semearDemo() {
  console.log("seed:demo: nada a fazer ainda (implementado na Fase 6).");
}

semearDemo().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
