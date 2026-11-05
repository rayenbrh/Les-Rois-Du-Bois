import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate PDF from HTML template using Puppeteer
 * Supports Arabic text and RTL layout
 * @param {Object} params - { templatePath, templateData, outputPath, landscape }
 * @returns {Promise<string>} - Path to generated PDF file
 */
export const generatePDFFromHTML = async ({ templatePath, templateData, outputPath, landscape = false }) => {
  let browser;
  try {
    // Read HTML template
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Compile template with Handlebars
    const template = Handlebars.compile(templateContent);
    const html = template(templateData);

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    
    // Set content with Arabic support
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    // Generate PDF
    await page.pdf({
      path: outputPath,
      format: 'A4',
      landscape: landscape,
      printBackground: true,
      margin: {
        top: '40px',
        right: '40px',
        bottom: '40px',
        left: '40px',
      },
    });

    await browser.close();
    return outputPath;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
};

