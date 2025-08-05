const express = require('express');
const router = express.Router();
const Produit = require('../models/Produit');

// Generate sequential referenceProduit
const generateReferenceProduit = async () => {
  const latestProduit = await Produit.findOne().sort({ referenceProduit: -1 }).exec();
  if (!latestProduit || !latestProduit.referenceProduit) {
    return 'P00001';
  }
  const lastNumber = parseInt(latestProduit.referenceProduit.slice(1), 10);
  return `P${String(lastNumber + 1).padStart(5, '0')}`;
};

// Create a produit
router.post('/', async (req, res) => {
  try {
    const { referenceProduit, ...produitData } = req.body;
    // Ignore provided referenceProduit and generate a new one
    const newReference = await generateReferenceProduit();
    const produit = new Produit({ ...produitData, referenceProduit: newReference });
    await produit.save();
    res.status(201).json(produit);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern.referenceProduit) {
      // Handle duplicate referenceProduit by retrying with a new reference
      try {
        const newReference = await generateReferenceProduit();
        const produit = new Produit({ ...req.body, referenceProduit: newReference });
        await produit.save();
        res.status(201).json(produit);
      } catch (retryErr) {
        res.status(400).json({ error: 'Failed to generate unique referenceProduit' });
      }
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

// Get all produits
router.get('/', async (req, res) => {
  try {
    const produits = await Produit.find().populate('fournisseurPrincipal');
    res.json(produits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a produit by ID
router.get('/:id', async (req, res) => {
  try {
    const produit = await Produit.findById(req.params.id).populate('fournisseurPrincipal');
    if (!produit) return res.status(404).json({ error: 'Produit not found' });
    res.json(produit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a produit
router.put('/:id', async (req, res) => {
  try {
    const { referenceProduit, ...updateData } = req.body; // Ignore referenceProduit in updates
    const produit = await Produit.findByIdAndUpdate(
      req.params.id,
      { ...updateData },
      { new: true }
    );
    if (!produit) return res.status(404).json({ error: 'Produit not found' });
    res.json(produit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a produit
router.delete('/:id', async (req, res) => {
  try {
    const produit = await Produit.findByIdAndDelete(req.params.id);
    if (!produit) return res.status(404).json({ error: 'Produit not found' });
    res.json({ message: 'Produit deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;