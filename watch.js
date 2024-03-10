const hourText = {
  1: 'ਇੱਕ',
  2: 'ਦੋ',
  3: 'ਤਿੰਨ',
  4: 'ਚਾਰ',
  5: 'ਪੰਜ',
  6: 'ਛੇ',
  7: 'ਸੱਤ',
  8: 'ਅੱਠ',
  9: 'ਨੌਂ',
  10: 'ਦਸ',
  11: 'ਗਿਆਰਾਂ',
  12: 'ਬਾਰਾਂ'
}

const minuteText = {
  ...hourText,
  13: 'ਤੇਰ੍ਹਾਂ',
  14: 'ਚੌਦਾਂ',
  15: 'ਸਵਾ',
  16: 'ਸੋਲਾਂ',
  17: 'ਸਤਾਰਾਂ',
  18: 'ਅਠਾਰਾਂ',
  19: 'ਉਨ੍ਹੀ',
  20: 'ਵੀਹ',
  21: 'ਇੱਕੀ',
  22: 'ਬਾਈ',
  23: 'ਤੇਈ',
  24: 'ਚੌਵੀ',
  25: 'ਪੱਚੀ',
  26: 'ਛੱਬੀ',
  27: 'ਸਤਾਈ',
  28: 'ਅਠਾਈ',
  29: 'ਉਣੱਤੀ',
  30: 'ਸਾਢੇ',
  31: 'ਇਕੱਤੀ',
  32: 'ਬੱਤੀ',
  33: 'ਤੇਤੀ',
  34: 'ਚੌਂਤੀ',
  35: 'ਪੈਂਤੀ',
  36: 'ਛੱਤੀ',
  37: 'ਸੈਂਤੀ',
  38: 'ਅਠੱਤੀ',
  39: 'ਉਣਤਾਲ਼ੀ',
  40: 'ਚਾਲੀ',
  41: 'ਇੱਕਤਾਲੀ',
  42: 'ਬਤਾਲੀ',
  43: 'ਤ੍ਰੈਤਾਲੀ',
  44: 'ਚੁਤਾਲੀ',
  45: 'ਪੌਣੇ',
  46: 'ਛਿਆਲੀ',
  47: 'ਸਤਾਲੀ',
  48: 'ਅਠਤਾਲੀ',
  49: 'ਉਨੰਜਾ',
  50: 'ਪੰਜਾਹ',
  51: 'ਇਕਵੰਜਾ',
  52: 'ਬਵੰਜਾ',
  53: 'ਤ੍ਰੀਪੰਜਾ',
  54: 'ਚੌਵੰਜਾ',
  55: 'ਪਚਵੰਜਾ',
  56: 'ਸ਼ਪੰਜਾ',
  57: 'ਸਤਵੰਜਾ',
  58: 'ਅਠਵੰਜਾ',
  59: 'ਉਨੱਠ',
  60: ''
};

const specialText = (hour, minute) => {
  if (hour == 1 && minute == 30) {
    return 'ਡੇੜ੍ਹ';
  } else if (hour == 2 && minute == 30) {
    return 'ਢਾਈ';
  } else {
    return null;
  }
}

const showTime = () => {
  const currentTime = new Date();

  const timeString = get12HourFormat(currentTime);
  const timeArray = timeString.split(':');

  const hour = parseInt(timeArray[0], 10);
  const minute = parseInt(timeArray[1], 10);

  const punjabiHour = hourText[hour];
  const punjabiMinute = minuteText[minute];

  const specialTextValue = specialText(hour, minute);
  const timeEl = document.querySelector('#time');

  if (specialTextValue) {
    timeEl.textContent = specialTextValue;
  } else if (minute == 15 || minute == 30) {
    timeEl.textContent = `${punjabiMinute} ${punjabiHour}`;
  } else if (minute == 45) {
    if (hour < 12) {
      timeEl.textContent = `${punjabiMinute} ${hourText[hour + 1]}`;
    } else {
      timeEl.textContent = `${punjabiMinute} ${hourText[1]}`;
    }
  } else if (minute == 60 || minute == 0) {
    timeEl.textContent = `${punjabiHour} ਵੱਜੇ`;
  } else {
    timeEl.textContent = `${punjabiHour} ${punjabiMinute}`;
  }
}

const get12HourFormat = (time) => {
  var timeIn12HourFormat = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return timeIn12HourFormat;
}
setInterval(() => {
  showTime();
}, 500);