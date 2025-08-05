const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const BonDeSortie = require('../models/BonDeSortie');
const Facture = require('../models/Facture');
const Produit = require('../models/Produit');

// Generate sequential numeroBonSortie
const generateNumeroBonSortie = async () => {
  try {
    const latestBon = await BonDeSortie.findOne().sort({ numeroBonSortie: -1 }).exec();
    if (!latestBon || !latestBon.numeroBonSortie) {
      return 'BS00001';
    }
    const lastNumber = parseInt(latestBon.numeroBonSortie.slice(2), 10);
    return `BS${String(lastNumber + 1).padStart(5, '0')}`;
  } catch (err) {
    throw new Error('Failed to generate numeroBonSortie');
  }
};

// Create a bon de sortie
router.post('/', async (req, res) => {
  try {
    console.log('POST /api/bons-de-sortie payload:', req.body);
    const { numeroBonSortie, factures, ...bonData } = req.body;

    // Validate factures
    if (!factures || !Array.isArray(factures) || factures.length === 0) {
      return res.status(400).json({ error: 'Factures is missing, not an array, or empty' });
    }
    for (const item of factures) {
      if (!item.facture || !mongoose.Types.ObjectId.isValid(item.facture)) {
        return res.status(400).json({ error: `Invalid facture ID: ${item.facture}` });
      }
      const facture = await Facture.findById(item.facture).populate('liste.produit');
      if (!facture) {
        return res.status(400).json({ error: `Facture not found: ${item.facture}` });
      }
      // Validate stock sufficiency
      for (const produitItem of facture.liste) {
        const produit = produitItem.produit;
        if (!produit) {
          return res.status(400).json({ error: `Produit not found in facture: ${item.facture}` });
        }
        if (produit.stockActuel < produitItem.quantite) {
          return res.status(400).json({
            error: `Insufficient stock for produit ${produit.nomProduit}: ${produit.stockActuel} available, ${produitItem.quantite} required`,
          });
        }
      }
    }

    // Update stock for each product (decrement for exit)
    for (const item of factures) {
      const facture = await Facture.findById(item.facture).populate('liste.produit');
      for (const produitItem of facture.liste) {
        const produit = await Produit.findById(produitItem.produit._id);
        produit.stockAvantMouvement = produit.stockActuel;
        produit.stockActuel -= produitItem.quantite;
        produit.stockApresMouvement = produit.stockActuel;
        await produit.save();
      }
    }

    // Calculate stock totals
    let stockAvantSortie = 0;
    let stockApresSortie = 0;
    for (const item of factures) {
      const facture = await Facture.findById(item.facture).populate('liste.produit');
      const totalQuantite = facture.liste.reduce((sum, prod) => sum + prod.quantite, 0);
      stockAvantSortie += totalQuantite;
      stockApresSortie += 0; // After exit, quantities are removed
    }

    // Generate numeroBonSortie
    const newNumero = await generateNumeroBonSortie();
    const bonDeSortie = new BonDeSortie({
      ...bonData,
      factures,
      numeroBonSortie: newNumero,
      stockAvantSortie,
      stockApresSortie,
    });
    await bonDeSortie.save();
    const populatedBon = await BonDeSortie.findById(bonDeSortie._id).populate('factures.facture');
    console.log('Saved bon de sortie:', populatedBon);
    res.status(201).json(populatedBon);
  } catch (err) {
    console.error('Error creating bon de sortie:', err);
    if (err.code === 11000 && err.keyPattern.numeroBonSortie) {
      // Handle duplicate numeroBonSortie by retrying
      try {
        const newNumero = await generateNumeroBonSortie();
        const bonDeSortie = new BonDeSortie({
          ...req.body,
          numeroBonSortie: newNumero,
          stockAvantSortie: req.body.stockAvantSortie || 0,
          stockApresSortie: req.body.stockApresSortie || 0,
        });
        await bonDeSortie.save();
        const populatedBon = await BonDeSortie.findById(bonDeSortie._id).populate('factures.facture');
        res.status(201).json(populatedBon);
      } catch (retryErr) {
        res.status(400).json({ error: 'Failed to generate unique numeroBonSortie' });
      }
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

// Get all bons de sortie
router.get('/', async (req, res) => {
  try {
    const bonsDeSortie = await BonDeSortie.find().populate('factures.facture');
    res.json(bonsDeSortie);
  } catch (err) {
    console.error('Error fetching bons de sortie:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a bon de sortie by ID
router.get('/:id', async (req, res) => {
  try {
    const bonDeSortie = await BonDeSortie.findById(req.params.id).populate('factures.facture');
    if (!bonDeSortie) return res.status(404).json({ error: 'Bon de sortie not found' });
    console.log('Fetched bon de sortie by ID:', bonDeSortie);
    res.json(bonDeSortie);
  } catch (err) {
    console.error('Error fetching bon de sortie by ID:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a bon de sortie
router.put('/:id', async (req, res) => {
  try {
    console.log('PUT /api/bons-de-sortie/:id payload:', req.body);
    const { numeroBonSortie, factures, ...updateData } = req.body;

    // Validate factures
    if (factures && (!Array.isArray(factures) || factures.length === 0)) {
      return res.status(400).json({ error: 'Factures is not an array or empty' });
    }
    if (factures) {
      for (const item of factures) {
        if (!item.facture || !mongoose.Types.ObjectId.isValid(item.facture)) {
          return res.status(400).json({ error: `Invalid facture ID: ${item.facture}` });
        }
        const facture = await Facture.findById(item.facture).populate('liste.produit');
        if (!facture) {
          return res.status(400).json({ error: `Facture not found: ${item.facture}` });
        }
        // Validate stock sufficiency
        for (const produitItem of facture.liste) {
          const produit = produitItem.produit;
          if (!produit) {
            return res.status(400).json({ error: `Produit not found in facture: ${item.facture}` });
          }
          if (produit.stockActuel < produitItem.quantite) {
            return res.status(400).json({
              error: `Insufficient stock for produit ${produit.nomProduit}: ${produit.stockActuel} available, ${produitItem.quantite} required`,
            });
          }
        }
      }
    }

    // If updating factures, handle stock adjustments
    if (factures) {
      const existingBon = await BonDeSortie.findById(req.params.id).populate('factures.facture');
      if (!existingBon) {
        return res.status(404).json({ error: 'Bon de sortie not found' });
      }

      // Revert previous stock changes (increment since these were exits)
      for (const item of existingBon.factures) {
        const facture = await Facture.findById(item.facture).populate('liste.produit');
        if (facture) {
          for (const produitItem of facture.liste) {
            const produit = await Produit.findById(produitItem.produit._id);
            if (produit) {
              produit.stockActuel += produitItem.quantite;
              produit.stockAvantMouvement = produit.stockActuel;
              produit.stockApresMouvement = produit.stockActuel;
              await produit.save();
            }
          }
        }
      }

      // Apply new stock changes (decrement for new exits)
      for (const item of factures) {
        const facture = await Facture.findById(item.facture).populate('liste.produit');
        for (const produitItem of facture.liste) {
          const produit = await Produit.findById(produitItem.produit._id);
          produit.stockAvantMouvement = produit.stockActuel;
          produit.stockActuel -= produitItem.quantite;
          produit.stockApresMouvement = produit.stockActuel;
          await produit.save();
        }
      }

      // Recalculate stock totals
      let stockAvantSortie = 0;
      let stockApresSortie = 0;
      for (const item of factures) {
        const facture = await Facture.findById(item.facture).populate('liste.produit');
        const totalQuantite = facture.liste.reduce((sum, prod) => sum + prod.quantite, 0);
        stockAvantSortie += totalQuantite;
        stockApresSortie += 0; // After exit, quantities are removed
      }
      updateData.stockAvantSortie = stockAvantSortie;
      updateData.stockApresSortie = stockApresSortie;
    }

    const bonDeSortie = await BonDeSortie.findByIdAndUpdate(req.params.id, { ...updateData, factures }, { new: true })
      .populate('factures.facture');
    if (!bonDeSortie) return res.status(404).json({ error: 'Bon de sortie not found' });
    res.json(bonDeSortie);
  } catch (err) {
    console.error('Error updating bon de sortie:', err);
    res.status(400).json({ error: err.message });
  }
});

// Delete a bon de sortie
router.delete('/:id', async (req, res) => {
  try {
    const bonDeSortie = await BonDeSortie.findById(req.params.id).populate('factures.facture');
    if (!bonDeSortie) return res.status(404).json({ error: 'Bon de sortie not found' });

    // Revert stock changes (increment since these were exits)
    for (const item of bonDeSortie.factures) {
      const facture = await Facture.findById(item.facture).populate('liste.produit');
      if (facture) {
        for (const produitItem of facture.liste) {
          const produit = await Produit.findById(produitItem.produit._id);
          if (produit) {
            produit.stockActuel += produitItem.quantite;
            produit.stockAvantMouvement = produit.stockActuel;
            produit.stockApresMouvement = produit.stockActuel;
            await produit.save();
          }
        }
      }
    }

    await BonDeSortie.findByIdAndDelete(req.params.id);
    res.json({ message: 'Bon de sortie deleted' });
  } catch (err) {
    console.error('Error deleting bon de sortie:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;