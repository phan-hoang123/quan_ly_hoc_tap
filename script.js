// --- 1. DARK MODE ---
function toggleTheme() {
  const body = document.body;
  const isDark = body.getAttribute("data-theme") === "dark";
  if (isDark) {
    body.removeAttribute("data-theme");
    document.getElementById("themeIcon").className = "fa-solid fa-moon";
    document.getElementById("themeText").innerText = "Chế độ tối";
    localStorage.setItem("theme", "light");
  } else {
    body.setAttribute("data-theme", "dark");
    document.getElementById("themeIcon").className = "fa-solid fa-sun";
    document.getElementById("themeText").innerText = "Chế độ sáng";
    localStorage.setItem("theme", "dark");
  }
}
if (localStorage.getItem("theme") === "dark") toggleTheme(); // Load theme đã lưu

// --- 2. DATA STATE & CORE LOGIC ---
let scheduleData = JSON.parse(localStorage.getItem("crm_schedule_v4")) || [];
let tasksData = []; // Bắt đầu bằng mảng rỗng, dữ liệu sẽ được C# trả về
const TASK_API_URL = "https://localhost:7172/api/tasks"; // Nhớ phải có chữ /api/tasks ở cuối nhé!
// Trục thời gian chuẩn theo Quy định của HaUI (Cơ sở 1, 2)
const periodTimeMap = {
  // Sáng
  1: "07:00",
  2: "07:50",
  3: "08:45",
  4: "09:40",
  5: "10:35",
  6: "11:25",
  // Chiều
  7: "12:30",
  8: "13:20",
  9: "14:15",
  10: "15:10",
  11: "16:05",
  12: "16:55",
  // Tối
  13: "18:00",
  14: "18:50",
  15: "19:45",
  16: "20:35",
};

function switchTab(tabId, el) {
  document
    .querySelectorAll(".page")
    .forEach((page) => page.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((nav) => nav.classList.remove("active"));

  document.getElementById(tabId).classList.add("active");
  if (el) el.classList.add("active"); // Thêm điều kiện if(el) để không bị lỗi khi tự gọi ngầm

  const titles = {
    dashboard: "Báo cáo hiệu suất hôm nay",
    schedule: "Quản lý lịch học",
    tasks: "Quản lý Task & Deadline",
    backup: "Sao lưu & Khôi phục dữ liệu",
    music: "Thư viện Âm nhạc",
    routine: "Thời gian biểu cá nhân ở nhà",
  };
  document.getElementById("pageTitle").innerText = titles[tabId];

  // GHI NHỚ TAB VÀO LOCALSTORAGE
  localStorage.setItem("activeTab", tabId);

  if (tabId === "dashboard") updateDashboard();
}

// --- LỊCH HỌC ---
let editingScheduleId = null; // Biến ghi nhớ xem ông đang sửa cái lịch nào

// Hàm tự động tính xem tuần này là tuần thứ mấy của kỳ học
function autoCalculateWeek() {
  const startDateVal = document.getElementById("semesterStartDate").value;
  if (!startDateVal) return;
  localStorage.setItem("crm_semester_start", startDateVal); // Nhớ ngày này để f5 không mất

  const startDate = new Date(startDateVal);
  const now = new Date();

  // Nếu chưa đến ngày khai giảng thì không tính
  if (now < startDate) return;

  const diffTime = Math.abs(now - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const currentWeek = Math.ceil(diffDays / 7);

  // Tự động điền Tuần hiện tại vào form và bộ lọc
  if (currentWeek > 0) {
    document.getElementById("weekInput").value = currentWeek;
    const weekFilter = document.getElementById("weekFilter");
    if (weekFilter && !weekFilter.value) {
      weekFilter.value = currentWeek;
      renderSchedule();
    }
  }
}

// Khôi phục mốc thời gian khi vừa load web
window.addEventListener("DOMContentLoaded", () => {
  const savedDate = localStorage.getItem("crm_semester_start");
  if (savedDate) {
    const dateInput = document.getElementById("semesterStartDate");
    if (dateInput) {
      dateInput.value = savedDate;
      autoCalculateWeek(); // Tự tính Tuần luôn
    }
  }
});

// HÀM LƯU LỊCH HỌC (DÙNG CHUNG CHO CẢ THÊM MỚI VÀ CẬP NHẬT)
function saveSchedule() {
  const week = document.getElementById("weekInput").value;
  const day = document.getElementById("daySelect").value;
  const start = parseInt(document.getElementById("startPeriod").value);
  const end = parseInt(document.getElementById("endPeriod").value);
  const subject = document.getElementById("subjectInput").value.trim();
  const room = document.getElementById("roomInput").value.trim();
  const note = document.getElementById("noteInput").value.trim();

  if (!week || !start || !end || !subject)
    return alert("Vui lòng nhập đủ số Tuần, Tiết và Tên môn!");

  if (editingScheduleId) {
    // CHẾ ĐỘ SỬA: Tìm cái lịch cũ và đè thông tin mới lên
    const index = scheduleData.findIndex(
      (item) => item.id === editingScheduleId,
    );
    if (index !== -1) {
      scheduleData[index] = {
        ...scheduleData[index],
        week: parseInt(week),
        day,
        startPeriod: start,
        periodStr: `${start} - ${end}`,
        startTime: periodTimeMap[start] || "00:00",
        subject,
        room,
        note,
      };
    }
    cancelEdit(); // Sửa xong thì quay về trạng thái Thêm Mới
  } else {
    // CHẾ ĐỘ THÊM MỚI
    scheduleData.push({
      id: Date.now(),
      week: parseInt(week),
      day,
      startPeriod: start,
      periodStr: `${start} - ${end}`,
      startTime: periodTimeMap[start] || "00:00",
      subject,
      room,
      note,
    });
  }

  saveData();
  renderSchedule();
  updateDashboard();

  // Chỉ xóa tên môn và phòng, giữ nguyên Tuần và Thứ để nhập nhiều môn 1 lúc cho nhanh
  document.getElementById("subjectInput").value = "";
  document.getElementById("roomInput").value = "";
  document.getElementById("noteInput").value = "";
}

// HÀM BẤM NÚT SỬA BÊN CẠNH LỊCH HỌC
function editSchedule(id) {
  const item = scheduleData.find((x) => x.id === id);
  if (!item) return;

  editingScheduleId = id; // Ghi nhớ ID đang sửa

  // Đổ dữ liệu cũ ngược lại lên các ô nhập liệu
  document.getElementById("weekInput").value = item.week || "";
  document.getElementById("daySelect").value = item.day;
  const periods = item.periodStr.split(" - "); // Cắt chữ "4 - 6" ra
  document.getElementById("startPeriod").value = periods[0];
  document.getElementById("endPeriod").value = periods[1];
  document.getElementById("subjectInput").value = item.subject;
  document.getElementById("roomInput").value = item.room;
  document.getElementById("noteInput").value = item.note || "";

  // Đổi màu và chữ cái nút Thêm thành Cập Nhật
  const btnSave = document.getElementById("btnSaveSchedule");
  btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Cập nhật';
  btnSave.style.background = "var(--success)";

  // Hiện nút Hủy
  document.getElementById("btnCancelEdit").style.display = "inline-flex";
}

// HÀM HỦY SỬA (QUAY VỀ BAN ĐẦU)
function cancelEdit() {
  editingScheduleId = null;
  const btnSave = document.getElementById("btnSaveSchedule");
  btnSave.innerText = "Thêm Lịch";
  btnSave.style.background = "var(--primary)";
  document.getElementById("btnCancelEdit").style.display = "none";

  document.getElementById("subjectInput").value = "";
  document.getElementById("roomInput").value = "";
  document.getElementById("noteInput").value = "";
}

function deleteSchedule(id) {
  scheduleData = scheduleData.filter((i) => i.id !== id);
  saveData();
  renderSchedule();
  updateDashboard();
}

function renderSchedule() {
  const container = document.getElementById("scheduleGridContainer");
  if (!container) return;

  const weekFilter = document.getElementById("weekFilter")
    ? document.getElementById("weekFilter").value
    : "";
  container.innerHTML = "";

  // 1. Lọc và sắp xếp theo Tiết học
  let filteredData = scheduleData
    .filter(
      (item) =>
        weekFilter === "" || (item.week && item.week.toString() === weekFilter),
    )
    .sort((a, b) => a.startPeriod - b.startPeriod);

  if (filteredData.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; color: var(--gray); padding: 40px; background: var(--white); border-radius: 12px;">Không có lịch học nào trong tuần này.</div>';
    return;
  }

  // 2. Gom nhóm lịch học theo từng Tuần
  const weeks = {};
  filteredData.forEach((item) => {
    const w = item.week || "Chưa rõ";
    if (!weeks[w]) weeks[w] = [];
    weeks[w].push(item);
  });

  const daysOfWeek = [
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
    "Chủ nhật",
  ];
  const days = [
    "Chủ nhật",
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
  ];
  const todayString = days[new Date().getDay()]; // Lấy ngày thực tế của máy tính

  // 3. Vẽ Khung lưới cho từng Tuần
  for (const w of Object.keys(weeks).sort((a, b) => a - b)) {
    let weekHtml = `
          <div style="margin-top: 25px; margin-bottom: 15px; padding: 10px 15px; background: var(--bg); border-left: 4px solid var(--primary); font-weight: bold; color: var(--text); font-size: 15px; text-transform: uppercase;">
              <i class="fa-solid fa-calendar-week" style="color: var(--primary); margin-right: 5px;"></i> Thời khóa biểu Tuần ${w}
          </div>
          <div class="timetable-grid">
      `;

    // Quét qua 7 ngày trong tuần, ngày nào không có môn thì báo "Trống"
    daysOfWeek.forEach((day) => {
      const dayItems = weeks[w].filter((x) => x.day === day);

      // Đổi màu nền xanh nếu cột đó trúng vào Thứ của ngày hôm nay
      const headerClass =
        day === todayString ? "timetable-header today" : "timetable-header";

      weekHtml += `
              <div class="timetable-col">
                  <div class="${headerClass}">${day}</div>
                  <div class="timetable-body">
          `;

      if (dayItems.length === 0) {
        weekHtml += `<div style="text-align: center; color: var(--gray); font-size: 12px; padding: 20px 0; font-style: italic;">Trống</div>`;
      } else {
        dayItems.forEach((item) => {
          let noteHtml = item.note
            ? `<div class="subj-note"><i class="fa-solid fa-thumbtack"></i> ${item.note}</div>`
            : "";
          weekHtml += `
                      <div class="subject-card">
                          <div class="subj-time"><i class="fa-regular fa-clock"></i> Tiết ${item.periodStr}</div>
                          <div class="subj-name">${item.subject}</div>
                          <div class="subj-room"><i class="fa-solid fa-location-dot"></i> ${item.room}</div>
                          ${noteHtml}
                          <div class="subj-actions">
                              <button class="btn-action" style="background: var(--success); padding: 4px 8px; font-size: 11px;" onclick="editSchedule(${item.id})"><i class="fa-solid fa-pen"></i></button>
                              <button class="btn-action" style="background: var(--danger); padding: 4px 8px; font-size: 11px;" onclick="deleteSchedule(${item.id})"><i class="fa-solid fa-trash"></i></button>
                          </div>
                      </div>
                  `;
        });
      }
      weekHtml += `</div></div>`;
    });

    weekHtml += `</div>`;
    container.innerHTML += weekHtml;
  }
}

// --- 3. TASKS & DEADLINE ---
// Hàm load danh sách Task từ MySQL (thông qua C# API)
async function fetchTasks() {
  try {
    const response = await fetch(TASK_API_URL);
    if (response.ok) {
      tasksData = await response.json();
      renderTasks();
      updateDashboard(); // Cập nhật lại % hoàn thành
    }
  } catch (error) {
    console.error("Lỗi kết nối Backend:", error);
  }
}

// Hàm thêm Task đẩy lên C#
async function addTask() {
  const name = document.getElementById("taskNameInput").value.trim();
  const deadline = document.getElementById("taskDeadlineInput").value;
  if (!name) return;

  const newTask = {
    name: name,
    deadline: deadline ? deadline : null, // Xử lý nếu không chọn ngày
    isDone: false,
  };

  try {
    await fetch(TASK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTask),
    });

    // Reset form và tải lại danh sách
    document.getElementById("taskNameInput").value = "";
    document.getElementById("taskDeadlineInput").value = "";
    fetchTasks();
  } catch (error) {
    alert("Không thể lưu lên Server!");
  }
}

// Cập nhật trạng thái xong/chưa xong (Cần API phương thức PUT bên C#)
async function toggleTask(id) {
  const t = tasksData.find((x) => x.id === id);
  if (!t) return;

  t.isDone = !t.isDone; // Đảo trạng thái (Lưu ý: Model C# dùng isDone thay vì done)

  try {
    await fetch(`${TASK_API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t),
    });
    fetchTasks();
  } catch (error) {
    console.error("Lỗi update:", error);
  }
}

// Xóa Task (Cần API phương thức DELETE bên C#)
async function deleteTask(id) {
  try {
    await fetch(`${TASK_API_URL}/${id}`, {
      method: "DELETE",
    });
    fetchTasks();
  } catch (error) {
    console.error("Lỗi xóa:", error);
  }
}

function calculateDeadlineStatus(dateString) {
  if (!dateString) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(dateString);
  dl.setHours(0, 0, 0, 0);
  const diffTime = dl - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0)
    return `<span class="deadline-badge deadline-danger"><i class="fa-solid fa-triangle-exclamation"></i> Quá hạn ${Math.abs(diffDays)} ngày</span>`;
  if (diffDays === 0)
    return `<span class="deadline-badge deadline-danger"><i class="fa-solid fa-fire"></i> Hạn chót: Hôm nay!</span>`;
  if (diffDays <= 3)
    return `<span class="deadline-badge deadline-warning"><i class="fa-regular fa-clock"></i> Còn ${diffDays} ngày</span>`;
  return `<span class="deadline-badge deadline-safe"><i class="fa-regular fa-calendar-check"></i> Còn ${diffDays} ngày</span>`;
}

function renderTasks() {
  const container = document.getElementById("taskListContainer");
  container.innerHTML = "";
  // Sort: Chưa xong lên trước, có deadline gần lên trước
  tasksData
    .sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1; // Sửa done -> isDone
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;
      if (a.deadline && b.deadline)
        return new Date(a.deadline) - new Date(b.deadline);
      return 0;
    })
    .forEach((task) => {
      const deadlineHtml = !task.isDone // Sửa done -> isDone
        ? calculateDeadlineStatus(task.deadline)
        : "";
      container.innerHTML += `
                    <div class="task-item ${task.isDone ? "done" : ""}"> 
                        <div style="display:flex; align-items:center; gap:15px; flex:1;">
                            <input type="checkbox" style="width:20px; height:20px;" ${task.isDone ? "checked" : ""} onchange="toggleTask(${task.id})">
                            <span class="task-name" style="font-weight: 500;">${task.name}</span>
                            ${deadlineHtml}
                        </div>
                        <button class="btn-danger" onclick="deleteTask(${task.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>`;
    });
}

// --- DASHBOARD ---
function updateDashboard() {
  const days = [
    "Chủ nhật",
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
  ];
  const now = new Date();
  const todayStr = days[now.getDay()];

  // 1. Kéo mốc thời gian ra để tính xem đang là Tuần mấy
  const startDateVal = localStorage.getItem("crm_semester_start");
  let currentWeek = 0;
  let isBeforeSemester = false;

  if (startDateVal) {
    const startDate = new Date(startDateVal);
    startDate.setHours(0, 0, 0, 0); // Đưa về mốc 0h để tính ngày cho chuẩn
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today < startDate) {
      isBeforeSemester = true; // Bắt mạch được bệnh: Chưa đến ngày khai giảng!
    } else {
      const diffTime = Math.abs(today - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // Cộng 1 để ngày khai giảng (diffDays = 0) vẫn tính là Tuần 1
      currentWeek = Math.ceil((diffDays === 0 ? 1 : diffDays) / 7);
    }
  }

  // 2. Xử lý logic hiển thị lên Bảng
  let todaySchedule = [];
  const tbToday = document.querySelector("#todayScheduleTable tbody");
  const titleToday = document.getElementById("todayScheduleTitle");

  if (!startDateVal) {
    // Trường hợp 1: Chơi hệ quên cài đặt ngày
    titleToday.innerText = `Lịch học ${todayStr}`;
    tbToday.innerHTML =
      '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--warning);">⚠️ Hãy sang tab Lịch Học cài "Ngày bắt đầu kỳ học" để xem lịch chính xác nhé!</td></tr>';
  } else if (isBeforeSemester) {
    // Trường hợp 2: Đang nghỉ phép chờ khai giảng
    titleToday.innerText = `Lịch học ${todayStr} (Chưa vào kỳ học)`;
    tbToday.innerHTML =
      '<tr><td colspan="4" style="text-align:center; padding: 20px;">Chưa có lịch học!</td></tr>';
  } else {
    // Trường hợp 3: Đã vào học (Lọc chuẩn ngày và tuần)
    titleToday.innerText = `Lịch học ${todayStr} - Tuần ${currentWeek}`;

    // ĐIỂM ĂN TIỀN Ở ĐÂY: Lọc phải đúng ngày VÀ đúng tuần
    todaySchedule = scheduleData.filter(
      (s) => s.day === todayStr && s.week === currentWeek,
    );

    if (todaySchedule.length === 0) {
      tbToday.innerHTML =
        '<tr><td colspan="4" style="text-align:center; padding: 20px;">Hôm nay trống lịch. Nghỉ ngơi thôi!</td></tr>';
    } else {
      tbToday.innerHTML = ""; // Xóa nền cũ để vẽ lại
      todaySchedule.forEach((item) => {
        tbToday.innerHTML += `<tr>
                  <td><span class="tag tag-hoc" style="padding: 3px 8px; margin-right: 5px;">T${item.week || "-"}</span> <b>${item.periodStr}</b></td>
                  <td style="color:var(--primary); font-weight: 500;">${item.startTime}</td>
                  <td><b>${item.subject}</b> ${item.note ? `<br><span style="font-size: 11px; color: var(--warning);"><i class="fa-solid fa-thumbtack"></i> ${item.note}</span>` : ""}</td>
                  <td>${item.room}</td>
              </tr>`;
      });
    }
  }

  // 3. Render lại phần Task (Giữ nguyên)
  const total = tasksData.length;
  const done = tasksData.filter((t) => t.isDone).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById("totalTasksCount").innerText = total;
  document.getElementById("completedTasksCount").innerText = done;
  document.getElementById("productivityScore").innerText = percent + "%";
  document.getElementById("progressBar").style.width = percent + "%";
}

// --- 4. BACKUP DATA (JSON) ---
function exportData() {
  const dataToExport = { schedule: scheduleData, tasks: tasksData };
  const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Workspace_Backup_${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.schedule && imported.tasks) {
        scheduleData = imported.schedule;
        tasksData = imported.tasks;
        saveData();
        renderSchedule();
        renderTasks();
        updateDashboard();
        alert("🎉 Khôi phục dữ liệu thành công!");
      } else alert("File không đúng định dạng backup của hệ thống.");
    } catch (error) {
      alert("Lỗi đọc file. Vui lòng chọn đúng file .json!");
    }
  };
  reader.readAsText(file);
}

// --- 5. POMODORO TIMER ---
let pomoInterval;
let timeLeft = 45 * 60; // 25 phút
function updatePomoDisplay() {
  const m = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const s = (timeLeft % 60).toString().padStart(2, "0");
  document.getElementById("pomoDisplay").innerText = `${m}:${s}`;
}
function startPomo() {
  if (pomoInterval) return; // Đang chạy rồi
  pomoInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updatePomoDisplay();
    } else {
      clearInterval(pomoInterval);
      pomoInterval = null;
      new Notification("Hết giờ!", { body: "Nghỉ ngơi 5 phút thôi nào!" });
    }
  }, 1000);
}
function pausePomo() {
  clearInterval(pomoInterval);
  pomoInterval = null;
}
function resetPomo() {
  pausePomo();
  timeLeft = 45 * 60;
  updatePomoDisplay();
}

// --- TÍNH NĂNG THU GỌN VÀ KÉO THẢ POMODORO ---

// 1. Hàm bật/tắt thu gọn
function togglePomoWidget() {
  const widget = document.getElementById("pomoBox");
  if (!widget) return;
  if (widget.classList.contains("minimized")) {
    widget.classList.remove("minimized");
    widget.onclick = null;
  } else {
    widget.classList.add("minimized");
    // Đang thu gọn thì click vào cục tròn sẽ mở ra
    setTimeout(() => {
      widget.onclick = togglePomoWidget;
    }, 100);
  }
}

// 2. Hàm kéo thả (Drag & Drop)
const pomoBox = document.getElementById("pomoBox");
const pomoHeader = document.getElementById("pomoHeader");

let isDragging = false;
let offsetX, offsetY;

if (pomoHeader && pomoBox) {
  pomoHeader.addEventListener("mousedown", (e) => {
    isDragging = true;
    // Tính toán khoảng cách
    offsetX = e.clientX - pomoBox.getBoundingClientRect().left;
    offsetY = e.clientY - pomoBox.getBoundingClientRect().top;
    pomoHeader.style.cursor = "grabbing";

    // CÁI NÀY LÀ THUỐC CHỮA BỆNH "KÉO GIÃN" NÀY:
    pomoBox.style.transition = "none"; // Tắt hiệu ứng trôi mượt để hộp bám dính chặt vào chuột
    document.body.style.userSelect = "none"; // Chống bôi đen text linh tinh khi đang kéo
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    pomoBox.style.bottom = "auto";
    pomoBox.style.right = "auto";
    pomoBox.style.left = `${e.clientX - offsetX}px`;
    pomoBox.style.top = `${e.clientY - offsetY}px`;
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    pomoHeader.style.cursor = "grab";

    // TRẢ LẠI TRẠNG THÁI BÌNH THƯỜNG KHI NHẢ CHUỘT:
    pomoBox.style.transition = "";
    document.body.style.userSelect = "";
  });
}
// --- HỆ THỐNG NHẮC NHỞ ---
function requestNotiPermission() {
  Notification.requestPermission();
}
// Tính năng nhắc lịch học 15p (Đã code ở phiên bản trước, giữ nguyên logic)
setInterval(() => {
  if (Notification.permission !== "granted") return;
  const now = new Date();
  const todayStr = [
    "Chủ nhật",
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
  ][now.getDay()];
  let notified = JSON.parse(localStorage.getItem("crm_notified")) || [];
  if (localStorage.getItem("last_date") !== todayStr) {
    notified = [];
    localStorage.setItem("last_date", todayStr);
  }

  scheduleData
    .filter((s) => s.day === todayStr)
    .forEach((item) => {
      const [h, m] = item.startTime.split(":").map(Number);
      let classTime = new Date();
      classTime.setHours(h, m, 0, 0);
      const diffMinutes = Math.round((classTime - now) / 60000);
      if (diffMinutes > 0 && diffMinutes <= 15 && !notified.includes(item.id)) {
        new Notification("Sắp đến giờ học!", {
          body: `${item.subject} bắt đầu lúc ${item.startTime}`,
        });
        notified.push(item.id);
        localStorage.setItem("crm_notified", JSON.stringify(notified));
      }
    });
}, 60000);

function saveData() {
  localStorage.setItem("crm_schedule_v4", JSON.stringify(scheduleData));
  localStorage.setItem("crm_tasks_v4", JSON.stringify(tasksData));
}

// --- 6. HỆ THỐNG PHÁT NHẠC NÂNG CAO (GIAO DIỆN & WIDGET) ---
let playlistData = [];
let currentTrack = 0;
let isShuffle = false;
let artistData = JSON.parse(localStorage.getItem("crm_artists")) || {};
let customTitleData =
  JSON.parse(localStorage.getItem("crm_custom_titles")) || {}; // Biến mới để nhớ tên bài hát tự sửa

const audio = document.getElementById("myAudio");
const trackNameUI = document.getElementById("trackName");
const btnPlay = document.getElementById("btnPlay");
const btnShuffle = document.getElementById("btnShuffle");
const playlistUI = document.getElementById("playlistUI");

const musicInput = document.getElementById("musicInput");
const mainMusicInput = document.getElementById("mainMusicInput");
const mainMusicList = document.getElementById("mainMusicList");
if (musicInput) musicInput.addEventListener("change", handleMusicUpload);
if (mainMusicInput)
  mainMusicInput.addEventListener("change", handleMusicUpload);

const MUSIC_API_URL = "https://localhost:7172/api/music";

function toggleWidget() {
  const widget = document.getElementById("musicWidget");
  if (!widget) return;
  if (widget.classList.contains("minimized")) {
    widget.classList.remove("minimized");
    widget.onclick = null;
  } else {
    widget.classList.add("minimized");
    setTimeout(() => {
      widget.onclick = toggleWidget;
    }, 100);
  }
}

// Hàm lưu Tên Ca sĩ
function saveArtistLocal(index, inputElement) {
  const titleKey = playlistData[index].title;
  artistData[titleKey] = inputElement.value;
  localStorage.setItem("crm_artists", JSON.stringify(artistData));

  if (index === currentTrack) {
    const cdArtistName = document.getElementById("cdArtistName");
    if (cdArtistName)
      cdArtistName.innerText = inputElement.value || "Đang cập nhật...";
  }
}

// Hàm lưu Tên Bài hát tự sửa (MỚI)
function saveCustomTitleLocal(index, inputElement) {
  const titleKey = playlistData[index].title;
  customTitleData[titleKey] = inputElement.value;
  localStorage.setItem("crm_custom_titles", JSON.stringify(customTitleData));

  // Nếu đang phát bài này thì update luôn text ở Đĩa than và Widget
  if (index === currentTrack) {
    const cdTrackName = document.getElementById("cdTrackName");
    if (cdTrackName) cdTrackName.innerText = inputElement.value || titleKey;
    if (trackNameUI) trackNameUI.innerText = inputElement.value || titleKey;
  }
  renderWidgetPlaylist(); // Cập nhật lại tên ở list nhỏ
}

// 3. Hàm Upload File (Đã thêm tính năng Check Trùng Lặp)
async function handleMusicUpload(e) {
  const files = e.target.files;
  if (files.length === 0) return;

  let hasNewUpload = false; // Biến kiểm tra xem có bài nào mới được up lên không

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (file.type.startsWith("audio/")) {
      // Tách đuôi .mp3 ra và ép tất cả thành chữ thường để so sánh chuẩn tuyệt đối
      const fileNameWithoutExt = file.name
        .replace(/\.[^/.]+$/, "")
        .toLowerCase();

      // Soi xem tên file này đã tồn tại trong mảng playlistData chưa
      const isDuplicate = playlistData.some((track) => {
        const originalTitle = track.title.toLowerCase();
        const customTitle = (customTitleData[track.title] || "").toLowerCase();
        // Check cả tên gốc lẫn tên tự sửa xem có trùng không
        return (
          originalTitle.includes(fileNameWithoutExt) ||
          customTitle.includes(fileNameWithoutExt)
        );
      });

      if (isDuplicate) {
        alert(`⚠️ Bài hát "${file.name}" đã có trong danh sách rồi ông ơi!`);
        continue; // Bỏ qua bài này, vòng lặp chạy tiếp sang bài kế tiếp
      }

      // Nếu không trùng thì mới đóng gói gửi lên C#
      const formData = new FormData();
      formData.append("file", file);

      try {
        await fetch(`${MUSIC_API_URL}/upload`, {
          method: "POST",
          body: formData,
        });
        hasNewUpload = true; // Đánh dấu là có nhạc mới
      } catch (error) {
        console.error("Lỗi upload bài:", file.name);
      }
    }
  }

  // Nếu có ít nhất 1 bài mới được up lên thì mới tải lại danh sách
  if (hasNewUpload) {
    fetchMusicList();
  }

  // Reset lại cái nút chọn file để lần sau ông chọn lại đúng file đó nó vẫn nhận diện
  e.target.value = "";
}

async function fetchMusicList() {
  try {
    // 1. Kiểm tra xem trước khi gọi API, danh sách nhạc có đang TRỐNG hay không
    const wasEmpty = playlistData.length === 0;

    // 2. Ghi nhớ tên bài hát đang phát dở (nếu có)
    let currentPlayingTitle = null;
    if (!wasEmpty && playlistData[currentTrack]) {
      currentPlayingTitle = playlistData[currentTrack].title;
    }

    const response = await fetch(MUSIC_API_URL);
    if (response.ok) {
      playlistData = await response.json();

      // 3. Tìm lại vị trí (index) mới của bài đang phát để không bị lệch mốc
      if (currentPlayingTitle) {
        const newIndex = playlistData.findIndex(
          (t) => t.title === currentPlayingTitle,
        );
        if (newIndex !== -1) {
          currentTrack = newIndex;
        }
      }

      renderWidgetPlaylist();
      renderMainMusicTable();

      // 4. CHỐT HẠ: Chỉ nạp bài đầu tiên VÀO LÚC MỞ WEB (từ 0 bài lên có bài)
      // Còn đang nghe mà import thêm (wasEmpty = false) thì tuyệt đối không gọi loadTrack nữa!
      if (wasEmpty && playlistData.length > 0) {
        loadTrack(0);
      }
    }
  } catch (error) {
    console.error("Lỗi lấy danh sách nhạc:", error);
  }
}

function loadTrack(index) {
  if (playlistData.length === 0) return;
  currentTrack = index;

  const track = playlistData[currentTrack];
  const titleKey = track.title;
  const displayTitle = customTitleData[titleKey] || titleKey; // Lấy tên tự sửa, nếu không có thì lấy tên gốc

  audio.src = `https://localhost:7172${track.fileUrl}`;

  if (trackNameUI) trackNameUI.innerText = displayTitle;
  const cdTrackName = document.getElementById("cdTrackName");
  if (cdTrackName) cdTrackName.innerText = displayTitle;
  const cdArtistName = document.getElementById("cdArtistName");
  if (cdArtistName)
    cdArtistName.innerText = artistData[titleKey] || "Đang cập nhật...";

  renderWidgetPlaylist();
  renderMainMusicTable();
}

let currentArtistFilter = "Tất cả"; // Nhớ bộ lọc hiện tại
let currentSearchQuery = ""; // Thêm dòng này để lưu từ khóa tìm kiếm

// Thêm hàm này để bắt sự kiện mỗi khi ông gõ phím vào ô tìm kiếm
function searchMusic() {
  currentSearchQuery = document
    .getElementById("musicSearchInput")
    .value.toLowerCase();
  renderMainMusicTable(); // Gọi lại hàm vẽ bảng để nó tự lọc
}

function filterByArtist(artist) {
  currentArtistFilter = artist;
  renderMainMusicTable();
  // Giao diện sẽ tự vẽ lại, menu tự đóng, siêu tiện!
}

function renderMainMusicTable() {
  const listContainer = document.getElementById("mainMusicList");
  const filterBar = document.getElementById("artistFilterBar");
  if (!listContainer || !filterBar) return;

  if (playlistData.length === 0) {
    listContainer.innerHTML =
      '<div style="text-align: center; color: var(--gray); padding: 30px;">Chưa có bài hát nào!</div>';
    filterBar.innerHTML = "";
    return;
  }

  // 1. Quét tìm tất cả các ca sĩ hiện có
  const artists = new Set(["Tất cả"]);
  playlistData.forEach((track) => {
    let a = artistData[track.title] || "Chưa phân loại";
    if (a.trim() === "") a = "Chưa phân loại";

    // Tuyệt chiêu chẻ chuỗi: Tự động tách nếu có chữ feat, ft, dấu phẩy hoặc &
    let splitNames = a.split(/ feat\. | ft\. | feat | x | ft |,| & /i);
    splitNames.forEach((name) => {
      if (name.trim() !== "") artists.add(name.trim());
    });
  });

  if (!artists.has(currentArtistFilter)) currentArtistFilter = "Tất cả";

  // 2. GIAO DIỆN NÚT 3 GẠCH (DROPDOWN)
  let dropdownHtml = `
        <div class="filter-dropdown-container">
            <button class="filter-btn" onclick="document.getElementById('artistMenu').classList.toggle('show')">
                <i class="fa-solid fa-bars"></i> Lọc ca sĩ: <span style="color: var(--primary); margin-left: 4px;">${currentArtistFilter}</span>
            </button>
            <div id="artistMenu" class="filter-menu">
    `;

  artists.forEach((artist) => {
    const isActive = artist === currentArtistFilter ? "active" : "";
    dropdownHtml += `<div class="filter-item ${isActive}" onclick="filterByArtist('${artist}')">${artist}</div>`;
  });

  dropdownHtml += `</div></div>`;
  filterBar.innerHTML = dropdownHtml; // Đổ menu vào web

  // 3. Lọc bài hát theo Ca sĩ VÀ Từ khóa tìm kiếm
  const filteredSongs = playlistData
    .map((track, originalIndex) => {
      let a = artistData[track.title] || "Chưa phân loại";
      if (a.trim() === "") a = "Chưa phân loại";
      return { track, originalIndex, artist: a };
    })
    .filter((item) => {
      // Điều kiện 1: Khớp với Menu lọc ca sĩ
      const matchArtist =
        currentArtistFilter === "Tất cả" ||
        item.artist.toLowerCase().includes(currentArtistFilter.toLowerCase());

      // Điều kiện 2: Khớp với thanh Tìm kiếm (check cả tên bài tự sửa lẫn tên ca sĩ)
      const displayTitle =
        customTitleData[item.track.title] || item.track.title;
      const matchSearch =
        currentSearchQuery === "" ||
        displayTitle.toLowerCase().includes(currentSearchQuery) ||
        item.artist.toLowerCase().includes(currentSearchQuery);

      // Phải thỏa mãn cả 2 điều kiện thì mới hiển thị bài hát ra
      return matchArtist && matchSearch;
    });

  // 4. Vẽ Danh sách bài hát (Đã fix lỗi bị bẹp text)
  listContainer.innerHTML = "";
  if (filteredSongs.length === 0) {
    listContainer.innerHTML =
      '<div style="text-align: center; color: var(--gray); padding: 20px;">Không có bài nào của ca sĩ này!</div>';
    return;
  }

  filteredSongs.forEach((item) => {
    const { track, originalIndex, artist } = item;
    const isAct = originalIndex === currentTrack;
    const displayTitle = customTitleData[track.title] || track.title;

    listContainer.innerHTML += `
            <div class="modern-song-item ${isAct ? "active-row" : ""}">
                <div style="width: 40px; text-align: center; font-weight: bold; color: var(--gray);">
                    ${isAct ? '<i class="fa-solid fa-chart-simple music-playing-icon" style="display:inline-block;"></i>' : originalIndex + 1}
                </div>
                
                <!-- CỤM TÊN BÀI VÀ CA SĨ -->
                <div style="flex: 1; padding: 0 10px; min-width: 0;">
                    <input type="text" class="ghost-input title-input" placeholder="Nhập tên bài hát..." value="${displayTitle}" 
                           onchange="saveCustomTitleLocal(${originalIndex}, this)">
                    <input type="text" class="ghost-input artist-input" placeholder="Nhập tên ca sĩ..." value="${artist === "Chưa phân loại" ? "" : artist}" 
                           onchange="saveArtistLocal(${originalIndex}, this); renderMainMusicTable();">
                </div>

                <!-- CỤM NÚT ACTION BÊN PHẢI -->
                <div style="text-align: right; white-space: nowrap;">
                    <button class="btn-action" style="padding: 8px 12px; font-size: 13px; background: ${isAct && !audio.paused ? "var(--warning)" : "var(--primary)"}" onclick="playSpecificTrack(${originalIndex})">
                        <i class="fa-solid ${isAct && !audio.paused ? "fa-pause" : "fa-play"}"></i> 
                    </button>
                    <button class="btn-action" style="background: var(--danger); padding: 8px 11px; font-size: 13px; margin-left: 5px;" onclick="deleteMusic(${originalIndex})">
                        <i class="fa-solid fa-trash"></i> 
                    </button>
                </div>
            </div>
        `;
  });
}

// Hàm Xóa nhạc khỏi danh sách
async function deleteMusic(index) {
  if (!confirm("Ông có chắc muốn xóa bài này khỏi danh sách không?")) return;

  const track = playlistData[index];

  try {
    // Đã mở khóa API xóa gọi thẳng vào C# bằng ID bài hát
    await fetch(`${MUSIC_API_URL}/${track.id}`, { method: "DELETE" });
  } catch (e) {
    console.error("Lỗi kết nối xóa nhạc trên Server:", e);
  }

  // Xóa bài khỏi mảng trên giao diện
  playlistData.splice(index, 1);

  // Cập nhật lại logic nếu đang phát đúng bài bị xóa
  if (index === currentTrack) {
    audio.pause();
    updatePlayPauseUI(false);
    if (playlistData.length > 0) loadTrack(0); // Tự nhảy về bài đầu tiên
  } else if (index < currentTrack) {
    currentTrack--; // Kéo số thứ tự bài đang phát lùi lại 1 nấc để không bị lệch
  }

  // Vẽ lại bảng và danh sách ở Widget nhỏ
  renderWidgetPlaylist();
  renderMainMusicTable();
}

function renderWidgetPlaylist() {
  if (!playlistUI) return;
  playlistUI.innerHTML = "";
  playlistData.forEach((track, index) => {
    const titleKey = track.title;
    const displayTitle = customTitleData[titleKey] || titleKey;
    const div = document.createElement("div");
    div.className = `playlist-item ${index === currentTrack ? "playing" : ""}`;
    div.innerHTML = `<i class="fa-solid fa-caret-right" style="visibility: ${index === currentTrack ? "visible" : "hidden"}"></i> ${displayTitle}`;
    div.onclick = () => {
      playSpecificTrack(index);
    };
    playlistUI.appendChild(div);
  });
}

function playSpecificTrack(index) {
  if (index === currentTrack) {
    togglePlay();
  } else {
    loadTrack(index);
    audio.play();
    updatePlayPauseUI(true);
  }
}

function updatePlayPauseUI(isPlaying) {
  if (btnPlay)
    btnPlay.innerHTML = isPlaying
      ? '<i class="fa-solid fa-pause"></i>'
      : '<i class="fa-solid fa-play"></i>';
  const cdBtnPlay = document.getElementById("cdBtnPlay");
  if (cdBtnPlay)
    cdBtnPlay.innerHTML = isPlaying
      ? '<i class="fa-solid fa-pause"></i>'
      : '<i class="fa-solid fa-play"></i>';
  const cdDisk = document.getElementById("cdDisk");
  if (cdDisk) {
    if (isPlaying) cdDisk.classList.add("playing");
    else cdDisk.classList.remove("playing");
  }
  renderMainMusicTable();
}

function togglePlay() {
  if (playlistData.length === 0) return;
  if (audio.paused) {
    audio.play();
    updatePlayPauseUI(true);
  } else {
    audio.pause();
    updatePlayPauseUI(false);
  }
}

function nextTrack() {
  if (playlistData.length === 0) return;
  if (isShuffle) {
    let r = currentTrack;
    while (r === currentTrack && playlistData.length > 1) {
      r = Math.floor(Math.random() * playlistData.length);
    }
    loadTrack(r);
  } else {
    loadTrack((currentTrack + 1) % playlistData.length);
  }
  audio.play();
  updatePlayPauseUI(true);
}

function prevTrack() {
  if (playlistData.length === 0) return;
  if (isShuffle) {
    let r = currentTrack;
    while (r === currentTrack && playlistData.length > 1) {
      r = Math.floor(Math.random() * playlistData.length);
    }
    loadTrack(r);
  } else {
    loadTrack((currentTrack - 1 + playlistData.length) % playlistData.length);
  }
  audio.play();
  updatePlayPauseUI(true);
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  if (btnShuffle) {
    btnShuffle.classList.toggle("active", isShuffle);
  }
  const cdBtnShuffle = document.getElementById("cdBtnShuffle");
  if (cdBtnShuffle) {
    cdBtnShuffle.classList.toggle("active", isShuffle);
  }
}

audio.addEventListener("ended", nextTrack);

// --- 7. QUẢN LÝ THỜI GIAN BIỂU CÁ NHÂN ---
let routineData = []; 
const ROUTINE_API_URL = "https://localhost:7172/api/routines"; 
let currentRoutineFilter = "Tất cả";

// Hàm load danh sách thời gian biểu từ C#
async function fetchRoutines() {
    try {
        const response = await fetch(ROUTINE_API_URL);
        if (response.ok) {
            routineData = await response.json();
            renderRoutine(); // Vẽ lại giao diện sau khi lấy được data
        }
    } catch (error) {
        console.error("Lỗi kết nối Backend lấy thời gian biểu:", error);
    }
}

// Hàm xử lý khi bấm vào dải nút ngang
function filterRoutineByDay(day, btnElement) {
  currentRoutineFilter = day;

  // Xóa hiệu ứng sáng ở tất cả các nút
  const buttons = document.querySelectorAll(".day-tab-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));

  // Bật hiệu ứng sáng cho nút vừa bấm
  if (btnElement) {
    btnElement.classList.add("active");
  }

  // Yêu cầu vẽ lại Timeline
  renderRoutine();
}

async function addRoutine() {
    const day = document.getElementById("routineDay").value;
    const start = document.getElementById("routineStart").value;
    const end = document.getElementById("routineEnd").value;
    const activity = document.getElementById("routineActivity").value.trim();
    const type = document.getElementById("routineType").value;

    if (!start || !end || !activity) return alert("Ông chưa nhập đủ thông tin kìa!");
    if (start === end) return alert("Giờ bắt đầu và kết thúc trùng nhau kìa!");

    const newRoutine = { day, start, end, activity, type };

    try {
        await fetch(ROUTINE_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRoutine),
        });

        document.getElementById("routineActivity").value = "";
        fetchRoutines(); // Lấy lại danh sách mới nhất từ server
    } catch (error) {
        alert("Không thể lưu lên Server!");
    }
}

async function deleteRoutine(id) {
    if (!confirm("Ông có chắc muốn xóa lịch trình này không?")) return;
    
    try {
        await fetch(`${ROUTINE_API_URL}/${id}`, { method: "DELETE" });
        fetchRoutines(); // Xóa xong tải lại danh sách
    } catch (error) {
        console.error("Lỗi xóa lịch trình:", error);
    }
}

function renderRoutine() {
  const container = document.getElementById("routineList");
  const filterVal = currentRoutineFilter;

  if (!container) return;
  container.innerHTML = "";

  let filteredData = routineData;

  // Thuật toán LỌC cực xịn: Nếu chọn "Thứ 3", nó sẽ show những việc của "Thứ 3" + những việc làm "Mỗi ngày"
  if (filterVal !== "Tất cả") {
    filteredData = routineData.filter((item) => {
      const itemDay = item.day || "Mỗi ngày";
      return itemDay === filterVal || itemDay === "Mỗi ngày";
    });
    // Sắp xếp lại theo giờ
    filteredData.sort((a, b) => a.start.localeCompare(b.start));
  }

  if (filteredData.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; color: var(--gray); padding: 40px; background: var(--white); border-radius: 12px; border: 1px solid var(--border);">Chưa có lịch trình nào. Hãy thêm vào nhé!</div>';
    return;
  }

  filteredData.forEach((item) => {
    let tagClass = "tag-canhan";
    let nodeColor = "var(--primary)"; // Màu mặc định cho dấu chấm timeline

    if (item.type === "Học tập") {
      tagClass = "tag-hoc";
      nodeColor = "#00838f";
    }
    if (item.type === "Giải trí") {
      tagClass = "tag-choi";
      nodeColor = "#ef6c00";
    }
    if (item.type === "Ngủ") {
      tagClass = "tag-ngu";
      nodeColor = "#3b3b98";
    }

    const itemDay = item.day || "Mỗi ngày";

    // Badge hiển thị Thứ
    const dayBadge =
      itemDay === "Mỗi ngày"
        ? `<span class="routine-day badge-everyday"><i class="fa-solid fa-calendar-check"></i> Mỗi ngày</span>`
        : `<span class="routine-day badge-specific">${itemDay}</span>`;

    container.innerHTML += `
            <div class="routine-item">
                <!-- Cột 1: Thời gian -->
                <div class="routine-time">
                    <div class="time-start">${item.start}</div>
                    <div class="time-end">${item.end}</div>
                </div>
                
                <!-- Cột 2: Trục Timeline -->
                <div class="routine-node" style="border-color: ${nodeColor};"></div>
                
                <!-- Cột 3: Thẻ nội dung -->
                <div class="routine-card">
                    <div class="routine-card-header">
                        <div class="routine-badges">
                            ${dayBadge}
                            <span class="tag ${tagClass}">${item.type}</span>
                        </div>
                        <button class="btn-delete-routine" onclick="deleteRoutine(${item.id})" title="Xóa lịch trình">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="routine-activity">${item.activity}</div>
                </div>
            </div>
        `;
  });
}

// Chạy hàm render khi web vừa load xong
renderRoutine();

// INIT APP
renderSchedule();
fetchTasks();
fetchRoutines();
updateDashboard();
updatePomoDisplay();
fetchMusicList();

// TỰ ĐỘNG PHỤC HỒI TAB ĐANG MỞ KHI F5
window.onload = () => {
  const savedTab = localStorage.getItem("activeTab");
  if (savedTab && savedTab !== "dashboard") {
    const navElements = document.querySelectorAll(".nav-item");
    let targetNav = navElements[0];

    // Tìm đúng cái nút Menu bên trái để làm cho nó sáng lên
    navElements.forEach((nav) => {
      if (
        nav.getAttribute("onclick") &&
        nav.getAttribute("onclick").includes(savedTab)
      ) {
        targetNav = nav;
      }
    });

    switchTab(savedTab, targetNav);
  }
};

// --- LOGIC THANH TIẾN TRÌNH NHẠC VÀ ÂM LƯỢNG ---
const progressSlider = document.getElementById("progressSlider");
const currentTimeEl = document.getElementById("currentTime");
const totalTimeEl = document.getElementById("totalTime");

// Đổi từ giây sang phút:giây (00:00)
function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

// Bắt sự kiện khi nhạc đang hát (Update thanh kéo)
if (audio) {
  audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
      const current = audio.currentTime;
      const duration = audio.duration;
      progressSlider.value = (current / duration) * 100;
      currentTimeEl.innerText = formatTime(current);

      // Highlight màu xanh lấp đầy thanh kéo từ trái sang phải
      progressSlider.style.background = `linear-gradient(to right, var(--primary) ${progressSlider.value}%, var(--border) ${progressSlider.value}%)`;
    }
  });

  // Lúc load bài hát mới sẽ update lại Tổng thời gian bài hát
  audio.addEventListener("loadedmetadata", () => {
    totalTimeEl.innerText = formatTime(audio.duration);
  });

  // Chức năng TUA NHẠC: Kéo thả chuột để tua
  progressSlider.addEventListener("input", () => {
    if (audio.duration) {
      audio.currentTime = (progressSlider.value / 100) * audio.duration;
    }
  });
}

// Hàm tắt tiếng / bật tiếng (Mute)
let isMuted = false;
function toggleMute() {
  isMuted = !isMuted;
  if (audio) audio.muted = isMuted;

  const volIcon = document.getElementById("volumeIcon");
  if (volIcon) {
    volIcon.className = isMuted
      ? "fa-solid fa-volume-xmark"
      : "fa-solid fa-volume-high";
    volIcon.style.color = isMuted ? "var(--danger)" : ""; // Tắt loa thì hiện màu đỏ
  }
}

// --- BẬT/TẮT BẢNG CHI TIẾT TIẾT HỌC ---
function openPeriodModal() {
  document.getElementById("periodModal").classList.add("show");
}
function closePeriodModal() {
  document.getElementById("periodModal").classList.remove("show");
}
// Bấm chuột ra ngoài khoảng đen thì bảng tự đóng
window.addEventListener("click", function (e) {
  const modal = document.getElementById("periodModal");
  if (e.target === modal) {
    closePeriodModal();
  }
});
