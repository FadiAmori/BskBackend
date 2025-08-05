const mongoose = require('mongoose');

const produitSchema = new mongoose.Schema({
  referenceProduit: { type: String, required: true, unique: true },
  nomProduit: { type: String, required: true },
  categorie: { type: String },
  description: { type: String },
  prixUnitaireHT: { type: Number, required: true },
  tvaApplicable: { type: Number, required: true },
  stockActuel: { type: Number, default: 0 },
  stockMinimal: { type: Number, default: 0 },
  seuilReapprovisionnement: { type: Number, default: 0 },
  fournisseurPrincipal: { type: mongoose.Schema.Types.ObjectId, ref: 'Fournisseur' },
  quantite: { type: Number },
  stockAvantMouvement: { type: Number },
  stockApresMouvement: { type: Number },
  recherche: { type: [String] },
  rechercheCorrespondance: { type: [String] }
});

module.exports = mongoose.model('Produit', produitSchema);