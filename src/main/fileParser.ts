import fs from 'fs'
import path from 'path'

export async function parseFile(filePath: string): Promise<{ text: string; filename: string }> {
  const ext = path.extname(filePath).toLowerCase()
  const filename = path.basename(filePath)

  if (ext === '.txt') {
    const text = fs.readFileSync(filePath, 'utf-8')
    return { text, filename }
  }

  if (ext === '.pdf') {

    const pdfParse = require('pdf-parse')
    const buffer = fs.readFileSync(filePath)
    const data = await pdfParse(buffer)
    return { text: data.text, filename }
  }

  if (ext === '.docx') {

    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ path: filePath })
    return { text: result.value, filename }
  }

  throw new Error(`Unsupported file type: ${ext}`)
}
