const mongoose = require('mongoose');

const factureSchema = new mongoose.Schema({
  numeroFacture: { type: String, required: true, unique: true },
  dateFacturation: { type: Date, default: Date.now },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  montantHT: { type: Number, required: true },
  tva: { type: Number, required: true },
  montantTTC: { type: Number, required: true },
  remise: { type: Number, default: 0 }, // Optional discount as percentage (e.g., 10 for 10%)
  dateEcheance: { type: Date },
  modePaiement: { type: String, enum: ['Chèque', 'Virement', 'Espèces', 'Traite'] },
  dateReglement: { type: Date },
  statut: { type: String, enum: ['Payée', 'Partiellement payée', 'En attente'], default: 'En attente' },
  recherche: { type: [String] },
  liste: [
    {
      produit: { type: mongoose.Schema.Types.ObjectId, ref: 'Produit', required: true },
      quantite: { type: Number, required: true, min: 1 },
    },
  ],
});

module.exports = mongoose.model('Facture', factureSchema);