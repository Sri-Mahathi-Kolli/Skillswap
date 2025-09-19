const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Handle CORS preflight requests
router.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.status(200).end();
});

// Serve files
router.get('/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../public/uploads', filename);
    
    console.log('🔍 Serving file:', filename);
    console.log('🔍 File path:', filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set CORS and CORP headers FIRST, before any other headers
    console.log('🔧 Setting CORS headers...');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    console.log('🔧 Headers set:', {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Cross-Origin-Resource-Policy': res.getHeader('Cross-Origin-Resource-Policy')
    });

    // Set appropriate content type
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    console.log('🔧 Final headers before streaming:', {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Cross-Origin-Resource-Policy': res.getHeader('Cross-Origin-Resource-Policy'),
      'Content-Type': res.getHeader('Content-Type')
    });
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('File serve error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Download file
router.get('/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../public/uploads', filename);
    
    console.log('📥 Download request for file:', filename);
    console.log('📥 File path:', filePath);
    console.log('📥 Query params:', req.query);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('❌ File not found:', filePath);
      return res.status(404).json({ error: 'File not found' });
    }

    // Get original filename from query parameter
    const originalName = req.query.originalName || filename;
    console.log('📥 Original filename:', originalName);
    
    // Set CORS and CORP headers FIRST, before any other headers
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Set appropriate headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    console.log('📥 Streaming file for download...');
    // Stream the file for download
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => {
      console.log('✅ File download completed successfully');
    });
    
    fileStream.on('error', (error) => {
      console.error('❌ File stream error:', error);
      res.status(500).json({ error: 'Failed to stream file' });
    });
  } catch (error) {
    console.error('❌ File download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

module.exports = router; 