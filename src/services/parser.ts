/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Parser thông minh phân tích câu hỏi trắc nghiệm tiếng Việt dành cho giáo viên THCS
 * Hỗ trợ nhận diện đa dạng định dạng: Word, Docs, Zalo, PDF, đề thi in ấn.
 * Tự động trích xuất: câu hỏi, 4 phương án (cả trên 1 dòng lẫn nhiều dòng),
 * đáp án đúng (*, #, Đáp án: A, Đ/A, Key...), hình ảnh đính kèm [Hình: url] và lời giải thích.
 */

import { Question, QuestionOption, OptionKey } from '../types';

export function parseVietnameseQuestions(rawText: string): Question[] {
  if (!rawText || !rawText.trim()) return [];

  // Chuẩn hóa dòng và dấu cách
  const lines = rawText.split(/\r?\n/);
  const cleanLines = lines.map(line => line.trim()).filter(line => line.length > 0);

  if (cleanLines.length === 0) return [];

  // Nhận diện dòng bắt đầu một câu hỏi mới:
  // "Câu 1:", "Câu 1.", "Câu 1 -", "Câu 1/", "Bài 1:", "CÂU 01:", "1.", "1)", "1:", "1 -", "Question 1:", "Q1:"
  const questionStartRegex = /^(?:câu|bài|question|q)\s*\d+[\.\:\)\-\/]|^\d+[\.\:\)\-\/]\s+/i;

  // 1. Phân tách thành các khối câu hỏi (blocks)
  let rawBlocks: string[][] = [];
  let currentBlock: string[] = [];

  let hasQuestionStartPattern = false;
  for (const line of cleanLines) {
    if (questionStartRegex.test(line)) {
      hasQuestionStartPattern = true;
      break;
    }
  }

  if (hasQuestionStartPattern) {
    for (let i = 0; i < cleanLines.length; i++) {
      const line = cleanLines[i];
      const isNewQuestion = questionStartRegex.test(line);

      if (isNewQuestion && currentBlock.length > 0) {
        rawBlocks.push(currentBlock);
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    }
    if (currentBlock.length > 0) {
      rawBlocks.push(currentBlock);
    }
  } else {
    // Nếu giáo viên không gõ "Câu 1:", phân tách bằng khoảng trắng đôi hoặc phân đoạn chứa A, B, C, D
    const paragraphs = rawText.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
    rawBlocks = paragraphs.map(p => p.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
  }

  return rawBlocks.map((blockLines, index) => parseSingleBlock(blockLines, index + 1));
}

function parseSingleBlock(lines: string[], questionNumber: number): Question {
  let questionText = '';
  const optionsMap: Partial<Record<OptionKey, string>> = {};
  let detectedAnswer: OptionKey | null = null;
  let explanation = '';
  let attachedImage: string | undefined = undefined;

  // Các regex nhận diện
  const answerRegex = /^(?:đáp\s*án\s*đúng|đáp\s*án|đ\/a|đa|key|answer|chọn|phương\s*án\s*đúng|câu\s*trả\s*lời|kết\s*quả)\s*[\:\=\-]?\s*([A-Da-d])/i;
  const explanationRegex = /^(?:giải\s*thích|lời\s*giải|hướng\s*dẫn\s*giải|hướng\s*dẫn|hdg|hd|vì|lý\s*do|ghi\s*chú)\s*[\:\=\-]?\s*(.*)$/i;
  
  // Nhận diện ảnh trong văn bản: [Hình: url], [Ảnh: url], Hình: url, Ảnh: url, ![ảnh](url), <img src="url">
  const imageTagRegex = /\[(?:hình|ảnh|hình\s*ảnh|link\s*ảnh|image)\s*[\:\=]?\s*([^\]]+)\]/i;
  const imageMarkdownRegex = /!\[[^\]]*\]\((https?:\/\/[^\)]+|data:image\/[^\)]+)\)/i;
  const imageLineRegex = /^(?:hình\s*ảnh|hình|ảnh|link\s*ảnh|url\s*ảnh)\s*[\:\=]\s*(https?:\/\/\S+|data:image\/\S+)/i;

  // 1. Tiền xử lý các dòng: Tách dòng nếu 1 dòng chứa nhiều phương án (VD: "A. Đồng  B. Gang  C. Nhôm  D. Nhựa")
  const expandedLines: string[] = [];
  for (const rawLine of lines) {
    // Kiểm tra xem dòng có phải là dòng chứa nhiều phương án không (ví dụ "A. ... B. ...")
    // Regex tìm các vị trí xuất hiện của phương án [A-D] có tiền tố khoảng trắng hoặc đầu dòng
    const multiOptionRegex = /(?:^|\s{2,}|\t+)([*#]?\s*[A-Da-d][\.\:\)])/g;
    const matches = Array.from(rawLine.matchAll(multiOptionRegex));

    if (matches.length >= 2) {
      // Dòng chứa từ 2 phương án trở lên -> Tách thành từng dòng riêng lẻ
      const splitPoints: number[] = [];
      for (const m of matches) {
        if (m.index !== undefined) {
          // Tính vị trí thực bắt đầu phương án
          const matchStr = m[0];
          const nonSpaceOffset = matchStr.search(/[*#A-Da-d]/);
          splitPoints.push(m.index + (nonSpaceOffset >= 0 ? nonSpaceOffset : 0));
        }
      }

      // Phần trước phương án đầu tiên (nếu có là phần câu hỏi)
      const firstOptPos = splitPoints[0];
      if (firstOptPos > 0) {
        const prefix = rawLine.substring(0, firstOptPos).trim();
        if (prefix) expandedLines.push(prefix);
      }

      for (let i = 0; i < splitPoints.length; i++) {
        const start = splitPoints[i];
        const end = i < splitPoints.length - 1 ? splitPoints[i + 1] : rawLine.length;
        const segment = rawLine.substring(start, end).trim();
        if (segment) expandedLines.push(segment);
      }
    } else {
      expandedLines.push(rawLine);
    }
  }

  let isReadingQuestion = true;
  const singleOptionRegex = /^([*#]?)\s*([A-Da-d])[\.\:\)]\s*(.*)$/;

  for (let i = 0; i < expandedLines.length; i++) {
    let line = expandedLines[i].trim();
    if (!line) continue;

    // A. Kiểm tra xem dòng có chứa hình ảnh đính kèm không
    const lineImgMatch = line.match(imageLineRegex);
    if (lineImgMatch) {
      attachedImage = lineImgMatch[1].trim();
      continue;
    }

    const tagImgMatch = line.match(imageTagRegex);
    if (tagImgMatch) {
      attachedImage = tagImgMatch[1].trim();
      line = line.replace(imageTagRegex, '').trim();
      if (!line) continue;
    }

    const mdImgMatch = line.match(imageMarkdownRegex);
    if (mdImgMatch) {
      attachedImage = mdImgMatch[1].trim();
      line = line.replace(imageMarkdownRegex, '').trim();
      if (!line) continue;
    }

    // B. Kiểm tra dòng Giải thích
    const explainMatch = line.match(explanationRegex);
    if (explainMatch) {
      explanation = explainMatch[1].trim();
      isReadingQuestion = false;
      continue;
    }

    // C. Kiểm tra dòng Đáp án
    const answerMatch = line.match(answerRegex);
    if (answerMatch) {
      detectedAnswer = answerMatch[1].toUpperCase() as OptionKey;
      isReadingQuestion = false;
      continue;
    }

    // D. Kiểm tra dòng Phương án A, B, C, D
    const optionMatch = line.match(singleOptionRegex);
    if (optionMatch) {
      isReadingQuestion = false;
      const marker = optionMatch[1]; // '*' hoặc '#'
      const optKey = optionMatch[2].toUpperCase() as OptionKey;
      let optText = optionMatch[3].trim();

      // Nếu có dấu * hoặc # ở trước hoặc sau text phương án
      if (
        marker === '*' || 
        marker === '#' || 
        optText.endsWith('*') || 
        optText.endsWith('#') ||
        optText.startsWith('*') ||
        optText.startsWith('#')
      ) {
        detectedAnswer = optKey;
        optText = optText.replace(/^[\*#]+|[\*#]+$/g, '').trim();
      }

      // Hỗ trợ trường hợp gõ [x] A hoặc (A) làm đáp án đúng
      if (/^\[x\]/i.test(line) || /^\(x\)/i.test(line)) {
        detectedAnswer = optKey;
      }

      optionsMap[optKey] = optText;
      continue;
    }

    // E. Nếu đang ở phần câu hỏi
    if (isReadingQuestion) {
      if (i === 0) {
        // Bỏ tiền tố "Câu 1:", "1.", v.v.
        const cleanedTitle = line
          .replace(/^(?:câu|bài|question|q)\s*\d+[\.\:\)\-\/]\s*/i, '')
          .replace(/^\d+[\.\:\)\-\/]\s*/, '')
          .trim();
        questionText = cleanedTitle;
      } else {
        questionText = questionText ? `${questionText} ${line}` : line;
      }
    } else {
      // Nếu đã qua các phương án nhưng có dòng tiếp theo (thường là phần nối tiếp của giải thích)
      if (explanation) {
        explanation = `${explanation} ${line}`;
      } else if (!detectedAnswer) {
        // Thử tìm xem dòng này có chứa đáp án rời rạc không
        const fallbackAnswer = line.match(/([A-Da-d])$/);
        if (fallbackAnswer && /đáp\s*án|key/i.test(line)) {
          detectedAnswer = fallbackAnswer[1].toUpperCase() as OptionKey;
        }
      }
    }
  }

  // 2. Chuyển map sang danh sách 4 phương án chuẩn
  const keys: OptionKey[] = ['A', 'B', 'C', 'D'];
  const options: QuestionOption[] = keys.map(key => ({
    key,
    text: optionsMap[key] || '',
  }));

  // 3. Xác thực tính hợp lệ của câu hỏi
  let isValid = true;
  let errorReason = '';

  if (!questionText.trim()) {
    isValid = false;
    errorReason = 'Thiếu nội dung câu hỏi';
  } else if (!optionsMap['A'] || !optionsMap['B'] || !optionsMap['C'] || !optionsMap['D']) {
    const missingKeys = keys.filter(k => !optionsMap[k]);
    isValid = false;
    errorReason = `Thiếu phương án: ${missingKeys.join(', ')}`;
  } else if (!detectedAnswer) {
    isValid = false;
    errorReason = 'Chưa xác định được đáp án đúng (thêm "Đáp án: X" hoặc đánh dấu *)';
  }

  return {
    id: `q-${Date.now()}-${questionNumber}-${Math.random().toString(36).substring(2, 7)}`,
    index: questionNumber,
    question: questionText.trim() || `Câu hỏi số ${questionNumber}`,
    options,
    answer: detectedAnswer || 'A',
    explanation: explanation.trim(),
    isValid,
    errorReason,
    image: attachedImage,
  };
}
