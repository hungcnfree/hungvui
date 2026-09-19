/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Sparkles, 
  Download, 
  Upload, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  HelpCircle,
  X,
  ImageIcon,
  ImagePlus,
  ZoomIn
} from 'lucide-react';
import { Question, OptionKey } from '../../types';
import { parseVietnameseQuestions } from '../../services/parser';
import { SAMPLE_QUESTIONS_RAW_TEXT } from '../../data/sampleQuestions';
import { exportQuestionsToJson, saveQuestions } from '../../services/storage';
import { soundEngine } from '../../services/soundEngine';
import { compressImageFile } from '../../utils/imageUtils';

interface QuestionInputScreenProps {
  questions: Question[];
  onQuestionsConfirmed: (questions: Question[]) => void;
}

export const QuestionInputScreen: React.FC<QuestionInputScreenProps> = ({
  questions: initialQuestions,
  onQuestionsConfirmed,
}) => {
  const [rawText, setRawText] = useState<string>('');
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>(initialQuestions);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Khởi tạo nếu đã có câu hỏi từ trước
  useEffect(() => {
    if (initialQuestions.length > 0 && parsedQuestions.length === 0) {
      setParsedQuestions(initialQuestions);
    }
  }, [initialQuestions]);

  // Xử lý khi bấm "Phân tích câu hỏi"
  const handleParse = (textToParse: string) => {
    soundEngine.playTick(1.0);
    const parsed = parseVietnameseQuestions(textToParse);
    setParsedQuestions(parsed);
    saveQuestions(parsed);
  };

  // Tải bộ câu hỏi mẫu Công nghệ 8
  const handleLoadSample = () => {
    soundEngine.playTick(1.2);
    setRawText(SAMPLE_QUESTIONS_RAW_TEXT);
    const parsed = parseVietnameseQuestions(SAMPLE_QUESTIONS_RAW_TEXT);
    setParsedQuestions(parsed);
    saveQuestions(parsed);
  };

  // Xóa một câu hỏi khỏi danh sách
  const handleDeleteQuestion = (id: string) => {
    soundEngine.playTick(0.8);
    const updated = parsedQuestions
      .filter(q => q.id !== id)
      .map((q, idx) => ({ ...q, index: idx + 1 }));
    setParsedQuestions(updated);
    saveQuestions(updated);
  };

  // Lưu chỉnh sửa câu hỏi từ Modal
  const handleSaveEditedQuestion = (updated: Question) => {
    soundEngine.playTick(1.4);
    const list = parsedQuestions.map(q => (q.id === updated.id ? updated : q));
    setParsedQuestions(list);
    saveQuestions(list);
    setEditingQuestion(null);
  };

  // Đính kèm trực tiếp ảnh cho 1 câu hỏi từ giao diện danh sách
  const handleDirectAttachImage = async (questionId: string, file: File) => {
    try {
      const base64 = await compressImageFile(file);
      const updated = parsedQuestions.map(q => {
        if (q.id === questionId) {
          return { ...q, image: base64 };
        }
        return q;
      });
      setParsedQuestions(updated);
      saveQuestions(updated);
      soundEngine.playTick(1.3);
    } catch (err) {
      alert('Không thể xử lý ảnh tải lên.');
    }
  };

  // Xóa ảnh của 1 câu hỏi
  const handleRemoveImage = (questionId: string) => {
    const updated = parsedQuestions.map(q => {
      if (q.id === questionId) {
        const copy = { ...q };
        delete copy.image;
        return copy;
      }
      return q;
    });
    setParsedQuestions(updated);
    saveQuestions(updated);
    soundEngine.playTick(0.9);
  };

  // Nhập file JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const imported = JSON.parse(content) as Question[];
        if (Array.isArray(imported) && imported.length > 0) {
          setParsedQuestions(imported);
          saveQuestions(imported);
          soundEngine.playCorrect();
          alert(`Đã nhập thành công ${imported.length} câu hỏi!`);
        } else {
          alert('File JSON không đúng cấu trúc danh sách câu hỏi.');
        }
      } catch (err) {
        alert('Lỗi đọc file JSON: định dạng không hợp lệ.');
      }
    };
    reader.readAsText(file);
  };

  const validQuestions = parsedQuestions.filter(q => q.isValid);
  const invalidQuestions = parsedQuestions.filter(q => !q.isValid);
  const canProceed = parsedQuestions.length > 0 && invalidQuestions.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner / Introduction */}
      <div className="bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-amber-950/40 p-6 rounded-3xl border border-amber-500/20 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              Bước 1: Soạn & Nhập Đề Trắc Nghiệm Thông Minh
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Dán Bộ Câu Hỏi Trắc Nghiệm Công Nghệ 8 / 9
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              Dán đề thi của thầy cô theo cách gõ quen thuộc (Word, Zalo, Google Docs, PDF). 
              Hệ thống tự động nhận diện cả phương án trên 1 dòng, đáp án đúng, lời giải thích và <span className="text-amber-400 font-bold">hình ảnh minh họa đính kèm</span>!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              id="btn-load-sample"
              onClick={handleLoadSample}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Tải bộ 10 câu mẫu CN 8
            </button>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              Hướng dẫn định dạng & hình ảnh
            </button>
          </div>
        </div>

        {/* Floating Help Banner */}
        {showHelp && (
          <div className="mt-4 p-5 rounded-2xl bg-slate-950/95 border border-slate-700 text-xs text-slate-300 space-y-3">
            <div className="font-bold text-amber-400 flex items-center justify-between text-sm">
              <span>Hỗ trợ định dạng thông minh & Đính kèm hình ảnh:</span>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <p className="font-semibold text-white">1. Phương án cùng 1 dòng hoặc nhiều dòng</p>
                <pre className="bg-slate-950 p-2 rounded text-slate-300 font-mono text-[11px] leading-relaxed">
{`Câu 1: Vật liệu kim loại đen gồm:
A. Đồng   B. Gang   C. Nhôm   D. Nhựa
Đáp án: B
Giải thích: Gang chứa chủ yếu là sắt.`}
                </pre>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <p className="font-semibold text-white">2. Đánh dấu * hoặc # đáp án đúng</p>
                <pre className="bg-slate-950 p-2 rounded text-slate-300 font-mono text-[11px] leading-relaxed">
{`2. Dụng cụ đo cơ khí đa năng là:
A. Thước lá
*B. Thước cặp
C. Thước đo góc
D. Thước cuộn`}
                </pre>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <p className="font-semibold text-white">3. Đính kèm ảnh trong nội dung</p>
                <pre className="bg-slate-950 p-2 rounded text-slate-300 font-mono text-[11px] leading-relaxed">
{`Câu 3: Sơ đồ sau thuộc loại mạch điện nào?
[Hình: https://example.com/so-do.png]
A. Mạch đèn cầu thang
B. Mạch bảng điện chính
*C. Mạch nối tiếp
D. Mạch song song`}
                </pre>
                <p className="text-[11px] text-amber-300/80 italic">
                  Thầy cô cũng có thể bấm nút "Đính kèm ảnh" trực tiếp trên từng câu ở bảng bên dưới!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-base font-bold text-slate-200 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            Khung dán nội dung câu hỏi
          </label>
          <div className="flex items-center gap-2">
            {/* Import JSON */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold cursor-pointer transition">
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              Nhập JSON
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            {/* Export JSON */}
            {parsedQuestions.length > 0 && (
              <button
                onClick={() => exportQuestionsToJson(parsedQuestions)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Xuất JSON
              </button>
            )}
          </div>
        </div>

        <textarea
          id="textarea-question-input"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`Dán các câu hỏi trắc nghiệm vào đây...
Ví dụ:
Câu 1: Vật liệu nào sau đây là kim loại đen?
A. Đồng    B. Gang    C. Nhôm    D. Nhựa
Đáp án: B
Giải thích: Gang chứa sắt nên thuộc kim loại đen.`}
          className="w-full h-60 bg-slate-950/70 border border-slate-800 focus:border-amber-500 rounded-2xl p-4 text-sm text-slate-200 font-sans leading-relaxed focus:outline-none transition resize-y"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-400">
            Hỗ trợ nhận diện thông minh cả khi 4 phương án nằm trên cùng 1 dòng hoặc đính kèm thẻ <span className="text-amber-400 font-semibold">[Hình: url]</span>!
          </div>

          <button
            id="btn-parse-questions"
            onClick={() => handleParse(rawText)}
            disabled={!rawText.trim()}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Phân tích câu hỏi
          </button>
        </div>
      </div>

      {/* Preview Table Section */}
      {parsedQuestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Bảng Xem Trước Bộ Đề</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-amber-400 font-extrabold border border-slate-700">
                  {parsedQuestions.length} câu
                </span>
                {parsedQuestions.some(q => q.image) && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-950/80 text-blue-300 font-bold border border-blue-800/80 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                    {parsedQuestions.filter(q => q.image).length} câu có ảnh
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {invalidQuestions.length > 0 ? (
                  <span className="text-rose-400 font-semibold">
                    Có {invalidQuestions.length} câu chưa hợp lệ (tô màu đỏ bên dưới). Vui lòng sửa hoặc xóa để tiếp tục.
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold">
                    Tất cả {validQuestions.length} câu đều hợp lệ và sẵn sàng!
                  </span>
                )}
              </p>
            </div>

            {/* Nút sang bước 2 */}
            <button
              id="btn-confirm-to-prep"
              onClick={() => {
                if (canProceed) {
                  soundEngine.playCorrect();
                  onQuestionsConfirmed(parsedQuestions);
                }
              }}
              disabled={!canProceed}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:hover:from-emerald-500 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/20 transition flex items-center gap-2.5 cursor-pointer"
            >
              <span>Xác nhận & Chuẩn bị giọng đọc</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Cards / Table Rows */}
          <div className="space-y-3">
            {parsedQuestions.map((q) => {
              const isInvalid = !q.isValid;
              return (
                <div
                  key={q.id}
                  className={`p-5 rounded-2xl border transition ${
                    isInvalid
                      ? 'bg-rose-950/30 border-rose-600/60 shadow-lg shadow-rose-950/20'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 space-y-3 w-full">
                      {/* Question Header & Content */}
                      <div className="flex items-start gap-3">
                        <span
                          className={`px-3 py-1 rounded-xl text-xs font-black tracking-wider uppercase shrink-0 ${
                            isInvalid
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          Câu {q.index}
                        </span>
                        <div className="font-bold text-base sm:text-lg text-white leading-snug">
                          {q.question}
                        </div>
                      </div>

                      {/* Error Banner if invalid */}
                      {isInvalid && (
                        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 font-medium">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                          <span>Lỗi phát hiện: {q.errorReason || 'Cấu trúc câu hỏi chưa đầy đủ'}</span>
                        </div>
                      )}

                      {/* Image Thumbnail Preview if attached */}
                      {q.image && (
                        <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-950/60 border border-slate-800 max-w-fit">
                          <div 
                            onClick={() => setViewingImage(q.image || null)}
                            className="relative w-20 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 cursor-pointer group shrink-0"
                          >
                            <img 
                              src={q.image} 
                              alt={`Hình minh họa câu ${q.index}`} 
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <ZoomIn className="w-4 h-4 text-white" />
                            </div>
                          </div>
                          <div className="text-xs space-y-1">
                            <div className="font-bold text-amber-400 flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Hình ảnh minh họa đính kèm</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setViewingImage(q.image || null)}
                                className="text-blue-400 hover:underline text-[11px] cursor-pointer"
                              >
                                Xem phóng to
                              </button>
                              <span className="text-slate-600">•</span>
                              <button
                                onClick={() => handleRemoveImage(q.id)}
                                className="text-rose-400 hover:underline text-[11px] cursor-pointer"
                              >
                                Xóa ảnh
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 4 Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt) => {
                          const isCorrect = opt.key === q.answer;
                          return (
                            <div
                              key={`${q.id}-${opt.key}`}
                              className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2.5 border transition ${
                                isCorrect
                                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-semibold shadow-sm shadow-emerald-500/20'
                                  : 'bg-slate-950/40 border-slate-800 text-slate-300'
                              }`}
                            >
                              <span
                                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                  isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {opt.key}
                              </span>
                              <span className="truncate">{opt.text || <span className="italic text-slate-600">Trống</span>}</span>
                              {isCorrect && <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto shrink-0" />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation Line */}
                      {q.explanation ? (
                        <div className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80 flex items-start gap-2">
                          <span className="font-bold text-amber-400 shrink-0">Giải thích:</span>
                          <span className="italic">{q.explanation}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic">
                          (Chưa có giải thích — Gemini sẽ tự động nhận xét và giải thích ngắn gọn khi tạo giọng đọc)
                        </div>
                      )}
                    </div>

                    {/* Action Buttons: Attach Image, Edit & Delete */}
                    <div className="flex sm:flex-col items-center gap-2 shrink-0">
                      {/* Nút đính kèm ảnh nhanh */}
                      <label 
                        title={q.image ? 'Đổi ảnh đính kèm' : 'Đính kèm hình ảnh cho câu này'}
                        className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                          q.image
                            ? 'bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border-blue-700/60'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        <ImagePlus className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleDirectAttachImage(q.id, file);
                          }}
                        />
                      </label>

                      <button
                        onClick={() => setEditingQuestion(q)}
                        title="Chỉnh sửa toàn bộ câu hỏi"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        title="Xóa câu hỏi này"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSave={handleSaveEditedQuestion}
        />
      )}

      {/* Lightbox Preview Image Modal */}
      {viewingImage && (
        <div 
          onClick={() => setViewingImage(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-3xl p-3 shadow-2xl flex flex-col items-center">
            <button 
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={viewingImage} 
              alt="Hình ảnh phóng to" 
              className="max-h-[75vh] w-auto object-contain rounded-2xl"
            />
            <span className="text-xs text-slate-400 mt-2">Bấm bất kỳ đâu để đóng</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Modal Chỉnh Sửa Một Câu Hỏi
interface EditQuestionModalProps {
  question: Question;
  onClose: () => void;
  onSave: (question: Question) => void;
}

const EditQuestionModal: React.FC<EditQuestionModalProps> = ({ question, onClose, onSave }) => {
  const [qText, setQText] = useState(question.question);
  const [optA, setOptA] = useState(question.options.find(o => o.key === 'A')?.text || '');
  const [optB, setOptB] = useState(question.options.find(o => o.key === 'B')?.text || '');
  const [optC, setOptC] = useState(question.options.find(o => o.key === 'C')?.text || '');
  const [optD, setOptD] = useState(question.options.find(o => o.key === 'D')?.text || '');
  const [answer, setAnswer] = useState<OptionKey>(question.answer);
  const [explanation, setExplanation] = useState(question.explanation || '');
  const [image, setImage] = useState<string | undefined>(question.image);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImageFile(file);
      setImage(base64);
      soundEngine.playTick(1.2);
    } catch {
      alert('Không thể đọc file ảnh.');
    }
  };

  const handleApplyUrl = () => {
    if (imageUrlInput.trim()) {
      setImage(imageUrlInput.trim());
      setImageUrlInput('');
      soundEngine.playTick(1.2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Question = {
      ...question,
      question: qText.trim(),
      options: [
        { key: 'A', text: optA.trim() },
        { key: 'B', text: optB.trim() },
        { key: 'C', text: optC.trim() },
        { key: 'D', text: optD.trim() },
      ],
      answer,
      explanation: explanation.trim(),
      isValid: Boolean(qText.trim() && optA.trim() && optB.trim() && optC.trim() && optD.trim()),
      image: image || undefined,
    };
    onSave(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-amber-400" />
            Sửa Câu {question.index}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Nội dung câu hỏi:</label>
            <textarea
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              rows={2}
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Phần Đính Kèm Hình Ảnh */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" />
                <span>Hình ảnh đính kèm (sơ đồ mạch, bản vẽ, dụng cụ...)</span>
              </label>
              {image && (
                <button
                  type="button"
                  onClick={() => setImage(undefined)}
                  className="text-xs text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa ảnh này
                </button>
              )}
            </div>

            {image ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-700 max-h-48 bg-slate-900 flex items-center justify-center">
                <img src={image} alt="Xem trước ảnh" className="max-h-48 w-auto object-contain" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Tải ảnh từ máy tính / điện thoại</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Hoặc dán đường link ảnh (URL)..."
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    disabled={!imageUrlInput.trim()}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-amber-400 border border-slate-700 cursor-pointer"
                  >
                    Dán
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['A', 'B', 'C', 'D'] as OptionKey[]).map((key) => {
              const val = key === 'A' ? optA : key === 'B' ? optB : key === 'C' ? optC : optD;
              const setVal = key === 'A' ? setOptA : key === 'B' ? setOptB : key === 'C' ? setOptC : setOptD;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Phương án {key}:</label>
                    <label className="text-xs flex items-center gap-1 cursor-pointer text-slate-400">
                      <input
                        type="radio"
                        name="correct-answer"
                        checked={answer === key}
                        onChange={() => setAnswer(key)}
                      />
                      <span className={answer === key ? 'text-emerald-400 font-bold' : ''}>Đáp án đúng</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              );
            })}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Giải thích đáp án (tùy chọn):</label>
            <input
              type="text"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Nhập lời giải thích hoặc để trống để AI tự tạo..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
