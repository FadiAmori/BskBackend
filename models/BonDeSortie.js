const mongoose = require('mongoose');

const bonDeSortieSchema = new mongoose.Schema({
  numeroBonSortie: { type: String, required: true, unique: true },
  dateSortie: { type: Date, default: Date.now },
  factures: [{ 
    facture: { type: mongoose.Schema.Types.ObjectId, ref: 'Facture' }
  }],
  motifSortie: { type: String, enum: ['Vente', 'Don', 'Transfert', 'Usage interne'] },
  destination: { type: String },
  matriculeVehicule: { type: String },
  nomChauffeur: { type: String },
  stockAvantSortie: { type: Number },
  stockApresSortie: { type: Number },
  responsableSortie: { type: String },
  recherche: { type: [String] }
});

module.exports = mongoose.model('BonDeSortie', bonDeSortieSchema);