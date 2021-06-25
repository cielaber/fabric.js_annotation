export default function format(date, fmt) {
  const obj = {
    'q+': Math.floor((date.getMonth() + 3) / 3), // 季度
    'M+': date.getMonth() + 1, // 月
    'd+': date.getDate(), // 日
    'h+': date.getHours(), // 小时
    'm+': date.getMinutes(), // 分钟
    's+': date.getSeconds(), // 秒
    S: date.getMilliseconds(), // 毫秒
  };
  let newDate = fmt;
  if (/(y+)/.test(newDate)) {
    newDate = newDate.replace(RegExp.$1, (`${date.getFullYear()}`).substr(4 - RegExp.$1.length));
  }
  Object.keys(obj).forEach((keys) => {
    if (new RegExp(`(${keys})`).test(newDate)) {
      newDate = newDate.replace(RegExp.$1, (RegExp.$1.length === 1) ? (obj[keys]) : ((`00${obj[keys]}`).substr((`${obj[keys]}`).length)));
    }
  });
  return newDate;
}
