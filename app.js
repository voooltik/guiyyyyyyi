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

function getCoordinates(placeName) {
  return fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`)
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      } else {
        return Promise.reject('Место не найдено');
      }
    });
}

function getUserCoordinates(defaultPlaceName = "Советская площадь") {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        resolve([pos.coords.latitude, pos.coords.longitude]);
      }, () => {
        getCoordinates(defaultPlaceName).then(resolve).catch(reject);
      }, {timeout: 5000});
    } else {
      getCoordinates(defaultPlaceName).then(resolve).catch(reject);
    }
  });
}

function renderRouteOnMap(startCoords, endCoords) {
  if (mapInstance) mapInstance.remove();

  mapInstance = L.map("map").setView(startCoords, 14);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(mapInstance);

  L.marker(startCoords).addTo(mapInstance).bindPopup("Вы здесь").openPopup();
  L.marker(endCoords).addTo(mapInstance).bindPopup("Место назначения");

  const url = `https://router.project-osrm.org/route/v1/foot/${startCoords[1]},${startCoords[0]};${endCoords[1]},${endCoords[0]}?overview=full&geometries=geojson`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (data.routes && data.routes[0]) {
        L.geoJSON(data.routes[0].geometry, {
          style: { color: "deepskyblue", weight: 5 },
        }).addTo(mapInstance);
      } else {
        alert("Маршрут не найден");
      }
    })
    .catch(() => alert("Ошибка при построении маршрута"));
}

window.addEventListener("load", () => {
  const navButtons = {
    route: document.getElementById("nav-route"),
    promos: document.getElementById("nav-promos"),
    tinder: document.getElementById("nav-tinder"),
  };

  const sections = {
    main: document.getElementById("main-section"),
    route: document.getElementById("route-display"),
    promos: document.getElementById("promos"),
    tinder: document.getElementById("tinder-section"),
    placeInfo: document.getElementById("place-info"),
  };

  Object.entries(navButtons).forEach(([key, btn]) => {
    btn.addEventListener("click", () => {
      Object.values(sections).forEach((s) => (s.style.display = "none"));
      Object.values(navButtons).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      sections[key].style.display = "block";
      if (key === "tinder") renderTinderCard();

      // При переключении обратно на выбор места восстанавливаем UI кнопок и карточек
      if (key === "tinder") {
        document.getElementById("tinder-card").style.display = "block";
        document.querySelector(".tinder-buttons").style.display = "flex";
        document.getElementById("back-to-tinder").style.display = "none";
      }
    });
  });

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

    route = places
      .filter(
        (p) =>
          p.tags.some((tag) => selectedTags.has(tag)) &&
          (ageFilter === "all" || p.age === ageFilter || p.age === "all")
      )
      .slice(0, maxPlaces);

    if (route.length === 0) {
      alert("По выбранным категориям нет подходящих мест.");
      return;
    }

    currentStep = 0;
    stage = "map";
    sections.main.style.display = "none";
    sections.route.style.display = "block";
    navButtons.route.classList.add("active");

    getUserCoordinates(startPoint)
      .then((startCoords) => {
        renderRouteOnMap(startCoords, route[currentStep].coordinates);
        showStep();
      })
      .catch(() => {
        alert("Не удалось определить начальную точку. Используем Советскую площадь.");
        getCoordinates("Советская площадь").then((startCoords) => {
          renderRouteOnMap(startCoords, route[currentStep].coordinates);
          showStep();
        });
      });
  });

  // Кнопка "Назад" для возврата из режима «Иду» в выбор места
  const backBtn = document.getElementById("back-to-tinder");
  backBtn.style.display = "none"; // по умолчанию скрыта

  backBtn.addEventListener("click", () => {
    sections.route.style.display = "none";
    sections.tinder.style.display = "block";
    navButtons.route.classList.remove("active");
    navButtons.tinder.classList.add("active");

    // Восстанавливаем выбор места
    document.getElementById("tinder-card").style.display = "block";
    document.querySelector(".tinder-buttons").style.display = "flex";
    backBtn.style.display = "none";

    // Очищаем маршрут и сбрасываем состояние
    route = [];
    currentStep = 0;
    stage = "map";
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
        tagWrap.style.display = tagWrap.style.display === "none" ? "grid" : "none";
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
    if (!places.length || tinderIndex >= places.length) return;

    // Выбрали место — делаем из него маршрут из одного пункта
    route = [places[tinderIndex]];
    currentStep = 0;
    stage = "map";

    // Показываем карту и кнопку «Назад», скрываем выбор
    sections.main.style.display = "none";
    sections.route.style.display = "block";
    navButtons.route.classList.add("active");
    navButtons.tinder.classList.remove("active");

    document.getElementById("tinder-card").style.display = "none";
    document.querySelector(".tinder-buttons").style.display = "none";

    backBtn.style.display = "inline-block";

    const startPoint = document.getElementById("startInput").value.trim() || "Советская площадь";

    getUserCoordinates(startPoint)
      .then((startCoords) => {
        renderRouteOnMap(startCoords, route[0].coordinates);
        showStep();
      })
      .catch(() => {
        alert("Не удалось определить начальную точку. Используем Советскую площадь.");
        getCoordinates("Советская площадь").then((startCoords) => {
          renderRouteOnMap(startCoords, route[0].coordinates);
          showStep();
        });
      });
  });

  function showStep() {
    const routeSection = document.getElementById("route-display");
    const infoSection = document.getElementById("place-info");
    const place = route[currentStep];

    if (stage === "map") {
      infoSection.style.display = "none";
      routeSection.style.display = "block";

      document.getElementById("route-progress").innerHTML = `<h2>${place.name}</h2>`;
      showButton("i-am-here", "Я тут", () => {
        stage = "info";
        showStep();
      });
    } else if (stage === "info") {
      routeSection.style.display = "none";
      infoSection.style.display = "block";

      document.getElementById("place-img").src = place.image;
      document.getElementById("place-name").textContent = place.name;
      document.getElementById("place-desc").textContent = place.description;

      document.getElementById("audio-btn").onclick = () =>
        alert("Аудиогид скоро будет доступен.");

      const nextBtn = document.getElementById("next-place");
      nextBtn.style.display = "inline-block";
      nextBtn.onclick = () => {
        currentStep++;
        if (currentStep >= route.length) {
          finishRoute();
          return;
        }
        stage = "map";

        const prevPlace = route[currentStep - 1];
        const nextPlace = route[currentStep];

        getUserCoordinates(prevPlace.name)
          .then((startCoords) => {
            renderRouteOnMap(startCoords, nextPlace.coordinates);
            showStep();
          })
          .catch(() => {
            renderRouteOnMap(prevPlace.coordinates, nextPlace.coordinates);
            showStep();
          });
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

  function finishRoute() {
    alert("🎉 Поздравляем! Маршрут завершён.");

    route = [];
    currentStep = 0;
    stage = "map";

    sections.placeInfo.style.display = "none";
    sections.route.style.display = "none";
    sections.main.style.display = "block";

    Object.values(navButtons).forEach((b) => b.classList.remove("active"));

    selectedTags.clear();
    renderCategoryMenu();
  }
});
