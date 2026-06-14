const uploadInput = document.getElementById('audioUploadInput');
const importBtn = document.getElementById('btnImportAudio');
const audioPlayer = document.getElementById('audioPreviewPlayer');
const sourceTextarea = document.querySelector('textarea[placeholder="输入或抽取原文"]');
const translateBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.trim() === '机器翻译');

// 唤起文件选择
importBtn.addEventListener('click', () => {
  uploadInput.click();
});

// 选中音频加载
uploadInput.addEventListener('change', async (event) => {
  const targetFile = event.target.files[0];
  if (!targetFile) return;

  // 加载播放器
  const blobUrl = URL.createObjectURL(targetFile);
  audioPlayer.src = blobUrl;
  audioPlayer.style.display = 'block';
  audioPlayer.load();

  // 执行转写
  await transcribeAudioToText(targetFile);
});

// 转写函数（关闭云端弹窗，只打印日志不弹alert）
async function transcribeAudioToText(audioFile) {
  try {
    // 无密钥，直接跳过云端请求
    console.log("未配置OpenAI Key，跳过云端Whisper识别，请使用离线收音转写");
    return;
  } catch (error) {
    console.error('转写异常:', error);
  }
}

// 离线收音识别函数（播放音频后收音转文字回填原文框）
window.startOfflineAudioRecognition = function () {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('浏览器不支持离线语音识别');
    return;
  }
  const recog = new SpeechRecognition();
  recog.lang = 'en-US'; // 英文音频用en-US，中文改成zh-CN
  recog.continuous = false;

  recog.onresult = (resEvent) => {
    const text = resEvent.results[0][0].transcript;
    sourceTextarea.value = text;
    // 自动触发机器翻译生成参考译文
    if (translateBtn) translateBtn.click();
  };
  alert('请播放导入的音频，麦克风拾取声音转文字填入原文框');
  recog.start();
};

// 新增：一键清空音频播放器+清空原文输入框
window.clearAudioAndText = function(){
  // 清空音频
  audioPlayer.src = '';
  audioPlayer.style.display = 'none';
  uploadInput.value = '';
  // 清空原文框
  sourceTextarea.value = '';
}