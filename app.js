// app.js
let places = [];
let selectedTags = new Set();
let route = [];
let currentStep = 0;
let stage = "map"; // "map" или "info"
let mapInstance = null;
let tinderIndex = 0;

const categoryData = {
  "🖼 Культурное": {
    museum: "Музей",
    gallery: "Галерея",
    history: "Исторические места",
    monument: "Памятник"
  },
  "🍴 Еда и напитки": {
    restaurant: "Ресторан",
    cafe: "Кафе",
    bar: "Бар",
    streetfood: "Уличная еда"
  },
  "🎨 Современное и молодёжное": {
    streetart: "Стрит-арт",
    instagram: "Инстаграмные места",
    loft: "Креативные пространства",
    event: "Мероприятия / выставки",
    live: "Живая музыка"
  },
  "🚶 Активный отдых и прогулки": {
    park: "Парк",
    embankment: "Набережная",
    viewpoint: "Смотровая",
    walk: "Пешие маршруты",
    nature: "Природа"
  },
  "👪 Для компании / семьи": {
    withkids: "С детьми",
    date: "Для свидания",
    alone: "Для одиночных прогулок",
    group: "Для компании"
  },
  "🛍 Шопинг и сувениры": {
    market: "Рынки",
    souvenir: "Сувенирные лавки"
  }
};

window.addEventListener("load", () => {
  const navButtons = {
    route: document.getElementById("nav-route"),
    promos: document.getElementById("nav-promos"),
    tinder: document.getElementById("nav-tinder")
  };

  const sections = {
    main: document.getElementById("main-section"),
    route: document.getElementById("route-display"),
    promos: document.getElementById("promos"),
    tinder: document.getElementById("tinder-section"),
    placeInfo: document.getElementById("place-info")
  };

  Object.entries(navButtons).forEach(([key, btn]) => {
    btn.addEventListener("click", () => {
      Object.values(sections).forEach((s) => (s.style.display = "none"));
      Object.values(navButtons).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      sections[key].style.display = "block";
      if (key === "tinder") renderTinderCard();
    });
  });

  // Вызовем отрисовку категорий здесь — обязательно!
  renderCategoryMenu();

  fetch("./places.json")
    .then((res) => {
      if (!res.ok) throw new Error("Ошибка загрузки places.json");
      return res.json();
    })
    .then((data) => {
      places = data;
      renderTinderCard();
    })
    .catch((err) => {
      console.error(err);
      alert("Не удалось загрузить места");
      document.getElementById("tinder-card").textContent = "Места не загружены.";
    });

  document.getElementById("show-route").addEventListener("click", () => {
    if (selectedTags.size === 0) {
      alert("Пожалуйста, выберите хотя бы одну категорию.");
      return;
    }
    const ageFilter = document.getElementById("age").value;
    const duration = parseInt(document.getElementById("duration").value);
    const maxPlaces = duration * 2;
    const startPoint = document.getElementById("startInput").value.trim() || "Советская площадь";

    route = places.filter((p) =>
      p.tags.some((tag) => selectedTags.has(tag)) &&
      (ageFilter === "all" || p.age === ageFilter || p.age === "all")
    ).slice(0, maxPlaces);

    if (route.length === 0) {
      alert("По выбранным категориям нет подходящих мест.");
      return;
    }

    currentStep = 0;
    stage = "map";
    sections.main.style.display = "none";
    sections.route.style.display = "block";
    navButtons.route.classList.add("active");
    showStep(startPoint);
  });

  function renderCategoryMenu() {
    const container = document.getElementById("categories");
    container.innerHTML = "";
    for (let [groupName, tags] of Object.entries(categoryData)) {
      const groupDiv = document.createElement("div");
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "category-toggle";
      toggleBtn.textContent = groupName;

      const tagWrap = document.createElement("div");
      tagWrap.className = "tag-container";
      tagWrap.style.display = "none";

      toggleBtn.onclick = () => {
        tagWrap.style.display = tagWrap.style.display === "none" ? "flex" : "none";
      };

      for (let [tag, label] of Object.entries(tags)) {
        const tagEl = document.createElement("div");
        tagEl.className = "activity-circle";
        tagEl.dataset.tag = tag;
        tagEl.textContent = label;

        tagEl.onclick = () => {
          if (selectedTags.has(tag)) {
            selectedTags.delete(tag);
            tagEl.classList.remove("selected");
          } else {
            selectedTags.add(tag);
            tagEl.classList.add("selected");
          }
        };

        tagWrap.appendChild(tagEl);
      }

      groupDiv.appendChild(toggleBtn);
      groupDiv.appendChild(tagWrap);
      container.appendChild(groupDiv);
    }
  }

  function renderTinderCard() {
    const card = document.getElementById("tinder-card");
    if (!places.length) {
      card.textContent = "Места не загружены.";
      return;
    }
    if (tinderIndex >= places.length) {
      card.textContent = "Больше мест нет.";
      return;
    }
    const place = places[tinderIndex];
    card.innerHTML = `
      <h3>${place.name}</h3>
      <img src="${place.image}" alt="${place.name}" style="width:100%; border-radius:8px; margin-bottom:8px;" />
      <p>${place.description}</p>
    `;
  }

  document.getElementById("skip").addEventListener("click", () => {
    tinderIndex++;
    renderTinderCard();
  });

  document.getElementById("go").addEventListener("click", () => {
    alert(`Вы выбрали: ${places[tinderIndex].name}`);
    tinderIndex++;
    renderTinderCard();
  });

  function showStep(startPoint) {
    const routeSection = document.getElementById("route-display");
    const infoSection = document.getElementById("place-info");
    const place = route[currentStep];

    if (stage === "map") {
      infoSection.style.display = "none";
      routeSection.style.display = "block";

      // Добавим строку с прогрессом: сколько пройдено и общее количество
      const progressText = `Пройдено мест: ${currentStep + 1} / ${route.length}`;
      document.getElementById("route-progress").innerHTML = `
        <h2>${place.name}</h2>
        <p style="font-size: 0.9rem; color: #9ca3af;">${progressText}</p>
      `;

      showButton("i-am-here", "Я тут", () => {
        stage = "info";
        showStep();
      });

      if (mapInstance) {
        mapInstance.remove();
      }
      mapInstance = L.map("map").setView(place.coordinates, 16);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(mapInstance);

      L.marker(place.coordinates).addTo(mapInstance).bindPopup(place.name).openPopup();
    } else if (stage === "info") {
      routeSection.style.display = "none";
      infoSection.style.display = "block";

      document.getElementById("place-img").src = place.image;
      document.getElementById("place-name").textContent = place.name;
      document.getElementById("place-desc").textContent = place.description;

      document.getElementById("audio-btn").onclick = () => alert("Аудиогид скоро будет доступен.");

      const nextBtn = document.getElementById("next-place");
      nextBtn.style.display = "inline-block";
      nextBtn.onclick = () => {
        currentStep++;
        if (currentStep >= route.length) {
          alert("Маршрут завершён!");
          infoSection.style.display = "none";
          return;
        }
        stage = "map";
        showStep();
      };
    }
  }

  function showButton(id, text, onClick) {
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = id;
      btn.style.marginTop = "10px";
      const container = document.getElementById("route-progress");
      container.appendChild(btn);
    }
    btn.textContent = text;
    btn.onclick = onClick;
    btn.style.display = "inline-block";
  }
});