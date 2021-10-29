const createFullDateWidthCurrentTime = () => {
  let time = new Date();
  let year = time.getFullYear();
  let month = time.getMonth() + 1;
  let day = time.getDate();
  let hour = time.getHours();
  let min = time.getMinutes();
  if (min.toString().length === 1) {
    min = min + "0";
  }

  if (hour.toString().length === 1) {
    hour = "0" + hour;
  }

  const currentDate = `${day}/${month}/${year} ${hour}:${min}`;
  return currentDate;
};

module.exports = { createFullDateWidthCurrentTime };
