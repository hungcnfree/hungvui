/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SoundEngine: Bộ tổng hợp âm thanh trò chơi truyền hình hoàn toàn bằng Web Audio API
 * Không phụ thuộc file MP3 bên ngoài, hoạt động trơn tru 100% offline.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isBgmPlaying: boolean = false;
  private bgmInterval: any = null;
  private isDucked: boolean = false;

  constructor() {
    // Khởi tạo lười khi có tương tác đầu tiên của người dùng
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master BGM gain
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.08, this.ctx.currentTime); // Nhạc nền êm dịu, không lấn át lời nói

      // Master SFX gain
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.ctx && this.sfxGain && this.bgmGain) {
      const now = this.ctx.currentTime;
      this.sfxGain.gain.setValueAtTime(muted ? 0 : 0.35, now);
      this.bgmGain.gain.setValueAtTime(muted ? 0 : (this.isDucked ? 0.02 : 0.08), now);
    }
  }

  public getMute(): boolean {
    return this.isMuted;
  }

  // Tự động hạ âm lượng nhạc nền khi MC/AI bắt đầu đọc (Audio Ducking)
  public duckBgm(duck: boolean) {
    this.isDucked = duck;
    if (this.isMuted || !this.ctx || !this.bgmGain) return;
    const now = this.ctx.currentTime;
    const targetGain = duck ? 0.015 : 0.08;
    this.bgmGain.gain.cancelScheduledValues(now);
    this.bgmGain.gain.linearRampToValueAtTime(targetGain, now + 0.3);
  }

  // 1. Tiếng đúng: Hợp âm rải đi lên vui tươi (C5 - E5 - G5 - C6)
  public playCorrect() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const startTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const noteGain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.08);

      // Thêm chút sóng sine bồng bềnh
      const sine = this.ctx!.createOscillator();
      sine.type = 'sine';
      sine.frequency.setValueAtTime(freq * 2, startTime + idx * 0.08);

      const noteTime = startTime + idx * 0.08;
      noteGain.gain.setValueAtTime(0, noteTime);
      noteGain.gain.linearRampToValueAtTime(0.4, noteTime + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

      osc.connect(noteGain);
      sine.connect(noteGain);
      noteGain.connect(this.sfxGain!);

      osc.start(noteTime);
      sine.start(noteTime);
      osc.stop(noteTime + 0.5);
      sine.stop(noteTime + 0.5);
    });

    // Thêm tiếng vỗ tay mô phỏng bằng noise
    this.playApplause(0.7);
  }

  // Tiếng vỗ tay mô phỏng bằng dải lọc tạp âm
  private playApplause(duration = 0.8) {
    if (!this.ctx || !this.sfxGain) return;
    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.35));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      filter.Q.value = 1.5;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start();
    } catch {
      // Bỏ qua nếu trình duyệt chặn
    }
  }

  // 2. Tiếng sai: Hai nốt trầm đi xuống (Eb3 -> C3)
  public playWrong() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [155.56, 130.81]; // Eb3, C3
    const startTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      const noteTime = startTime + idx * 0.22;
      osc.frequency.setValueAtTime(freq, noteTime);

      // Bộ lọc làm mềm âm sắc
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 450;

      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.3, noteTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(noteTime);
      osc.stop(noteTime + 0.38);
    });
  }

  // 3. Tiếng tích tắc đếm ngược (được gọi đều đặn hoặc nhanh dần ở 5 giây cuối)
  public playTick(pitchMultiplier = 1.0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const now = this.ctx.currentTime;
    const baseFreq = 800 * pitchMultiplier;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.04);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // 4. Tiếng mở ô cửa (vút mở + ngân vang kim loại)
  public playDoorOpen() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  // 5. Tiếng quay số / may mắn
  public playSpin() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.07;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400 + i * 150, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  // 6. Tiếng chiến thắng tổng kết (Fanfare hoàng tráng)
  public playVictory() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const chords = [
      [523.25, 659.25, 783.99], // C
      [587.33, 739.99, 880.00], // D
      [659.25, 830.61, 987.77], // E
      [783.99, 987.77, 1174.66, 1567.98] // G + high G
    ];

    const now = this.ctx.currentTime;
    chords.forEach((chord, step) => {
      const stepTime = now + step * 0.22;
      chord.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, stepTime);

        const duration = step === chords.length - 1 ? 1.2 : 0.2;
        gain.gain.setValueAtTime(0.18, stepTime);
        gain.gain.exponentialRampToValueAtTime(0.001, stepTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain!);

        osc.start(stepTime);
        osc.stop(stepTime + duration + 0.05);
      });
    });

    this.playApplause(2.0);
  }

  // 7. Nhạc nền gameshow lặp nhẹ nhàng (BGM)
  public startBgm() {
    if (this.isBgmPlaying) return;
    this.initContext();
    this.isBgmPlaying = true;

    // Chuỗi hợp âm nhẹ nhàng vui tươi phong cách gameshow học đường
    const bassSequence = [130.81, 146.83, 164.81, 174.61, 196.00]; // C3, D3, E3, F3, G3
    let step = 0;

    const playBgmStep = () => {
      if (!this.isBgmPlaying || !this.ctx || !this.bgmGain) return;
      if (this.isMuted) return;

      const now = this.ctx.currentTime;
      const freq = bassSequence[step % bassSequence.length];
      step++;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(now);
      osc.stop(now + 0.6);
    };

    // Nhịp 120 bpm = 500ms mỗi nốt bass
    playBgmStep();
    this.bgmInterval = setInterval(playBgmStep, 500);
  }

  public stopBgm() {
    this.isBgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  public toggleBgm(): boolean {
    if (this.isBgmPlaying) {
      this.stopBgm();
      return false;
    } else {
      this.startBgm();
      return true;
    }
  }

  public isBgmActive(): boolean {
    return this.isBgmPlaying;
  }
}

export const soundEngine = new SoundEngine();
