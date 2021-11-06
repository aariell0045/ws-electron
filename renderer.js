const { ipcMain, ipcRenderer } = require("electron");
const XLSX = require("xlsx");
const input = document.querySelector("input");
input.addEventListener("change", function (e) {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.readAsArrayBuffer(file);

  reader.onload = async (event) => {
    const arrayBuffer = event.target.result;
    const workbook = XLSX.read(arrayBuffer, { type: "buffer" });
    const workSheetName = workbook.SheetNames[0];
    const workSheet = workbook.Sheets[workSheetName];
    const data = await XLSX.utils.sheet_to_json(workSheet);
    let ws = [];
    for (let i = 0; i < data.length - 1; i++) {
      let tempArray = [];
      for (let key in data[i]) {
        tempArray.push(data[i][key]);
      }
      ws.push(tempArray);
    };
    ipcRenderer.send("upload-finish", ws);
  };
});
