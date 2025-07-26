let places = [];
let selectedTags = new Set();
let route = [];
let currentStep = 0;
let stage = "map";
let mapInstance = null;
let tinderIndex = 0;
let totalDistance = 0;
let routeStartTime = null;

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

const DEFAULT_START = [57.6261, 39.8845];

function geocode(placeName) {
  return ymaps.geocode(placeName).then(res => {
    const firstGeoObject = res.geoObjects.get(0);
    if (!firstGeoObject) throw new Error('Место не найдено');
    return firstGeoObject.geometry.getCoordinates();
  });
}

function renderRouteFromTo(startCoords, endCoords) {
  return new Promise((resolve, reject) => {
    if (mapInstance) mapInstance.destroy();

    mapInstance = new ymaps.Map("map", {
      center: startCoords,
      zoom: 14,
      controls: ['zoomControl', 'fullscreenControl']
    });

    const startPlacemark = new ymaps.Placemark(startCoords, {
      balloonContent: 'Вы здесь'
    }, {
      preset: 'islands#blueCircleIcon'
    });

    const endPlacemark = new ymaps.Placemark(endCoords, {
      balloonContent: 'Место назначения'
    }, {
      preset: 'islands#redCircleIcon'
    });

    mapInstance.geoObjects.add(startPlacemark);
    mapInstance.geoObjects.add(endPlacemark);

    ymaps.route([startCoords, endCoords], {
      routingMode: 'pedestrian'
    }).then(routeObj => {
      totalDistance += routeObj.getLength();
      mapInstance.geoObjects.add(routeObj);
      mapInstance.setBounds(routeObj.getBounds(), { checkZoomRange: true });
      resolve();
    }).catch(err => {
      alert('Не удалось построить маршрут: ' + err.message);
      reject(err);
    });
  });
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

  function resetNavigation() {
    Object.values(navButtons).forEach(b => b.classList.remove("active"));
  }

  Object.entries(navButtons).forEach(([key, btn]) => {
    btn.addEventListener("click", () => {
      Object.values(sections).forEach(s => s.style.display = "none");
      resetNavigation();
      btn.classList.add("active");

      if (key === "route") {
        if (route.length === 0) {
          sections.main.style.display = "block";
          resetNavigation();
          navButtons.route.classList.remove("active");
          return;
        }
      }

      sections[key].style.display = "block";

      if (key === "tinder") {
        renderTinderCard();
        document.getElementById("tinder-card").style.display = "block";
        document.querySelector(".tinder-buttons").style.display = "flex";
        document.getElementById("back-to-main").style.display = "inline-block";
      }
    });
  });

  renderCategoryMenu();

  fetch("./places.json")
    .then(res => res.json())
    .then(data => {
      places = data;
      renderTinderCard();
    })
    .catch(err => {
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

    route = places.filter(p =>
      p.tags.some(tag => selectedTags.has(tag)) &&
      (ageFilter === "all" || p.age === ageFilter || p.age === "all")
    ).slice(0, maxPlaces);

    if (route.length === 0) {
      alert("По выбранным категориям нет подходящих мест.");
      return;
    }

    currentStep = 0;
    stage = "map";
    totalDistance = 0;
    routeStartTime = new Date();

    sections.main.style.display = "none";
    sections.route.style.display = "block";
    resetNavigation();
    navButtons.route.classList.add("active");

    const startPoint = document.getElementById("startInput").value.trim() || "Советская площадь";

    geocode(startPoint)
      .then(startCoords => renderRouteFromTo(startCoords, route[currentStep].coordinates).then(showStep))
      .catch(() => renderRouteFromTo(DEFAULT_START, route[currentStep].coordinates).then(showStep));
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
    } else {
      routeSection.style.display = "none";
      infoSection.style.display = "block";

      document.getElementById("place-img").src = place.image;
      document.getElementById("place-name").textContent = place.name;
      document.getElementById("place-desc").textContent = place.description;

      const nextBtn = document.getElementById("next-place");
      nextBtn.style.display = "inline-block";
      nextBtn.onclick = () => {
        currentStep++;
        if (currentStep >= route.length) {
          finishRoute();
          return;
        }
        stage = "map";
        renderRouteFromTo(route[currentStep - 1].coordinates, route[currentStep].coordinates).then(showStep);
      };
    }
  }

  function showButton(id, text, onClick) {
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = id;
      const container = document.getElementById("route-progress");
      container.appendChild(btn);
    }
    btn.textContent = text;
    btn.onclick = onClick;
    btn.style.display = "inline-block";
  }

  function finishRoute() {
    const totalMinutes = Math.round((new Date() - routeStartTime) / 60000);
    const totalKm = (totalDistance / 1000).toFixed(2);
    alert(`🎉 Маршрут завершён!\n\n📍 Посещено мест: ${route.length}\n🚶 Пройдено: ${totalKm} км\n⏱ Время: ${totalMinutes} минут.`);

    route = [];
    currentStep = 0;
    stage = "map";
    sections.placeInfo.style.display = "none";
    sections.route.style.display = "none";
    sections.main.style.display = "block";
    resetNavigation();
    navButtons.route.classList.remove("active");
    selectedTags.clear();
    renderCategoryMenu();
  }

  function renderTinderCard() {
    const card = document.getElementById("tinder-card");
    if (!places.length || tinderIndex >= places.length) {
      card.textContent = "Больше мест нет.";
      return;
    }
    const place = places[tinderIndex];
    card.innerHTML = `<h3>${place.name}</h3><img src="${place.image}" style="width:100%; border-radius:8px; margin-bottom:8px;"><p>${place.description}</p>`;
  }

  document.getElementById("skip").addEventListener("click", () => {
    tinderIndex++;
    renderTinderCard();
  });

  document.getElementById("go").addEventListener("click", () => {
    if (!places.length || tinderIndex >= places.length) return;
    route = [places[tinderIndex]];
    currentStep = 0;
    stage = "map";
    routeStartTime = new Date();
    sections.tinder.style.display = "none";
    sections.route.style.display = "block";
    resetNavigation();
    navButtons.route.classList.add("active");
    const startPoint = document.getElementById("startInput").value.trim() || "Советская площадь";
    geocode(startPoint)
      .then(startCoords => renderRouteFromTo(startCoords, route[0].coordinates).then(showStep))
      .catch(() => renderRouteFromTo(DEFAULT_START, route[0].coordinates).then(showStep));
  });

  document.getElementById("back-from-place-info").addEventListener("click", () => {
    sections.placeInfo.style.display = "none";
    sections.route.style.display = "block";
  });

  document.getElementById("back-to-main").addEventListener("click", () => {
    sections.tinder.style.display = "none";
    sections.main.style.display = "block";
    resetNavigation();
    navButtons.route.classList.add("active");
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
});
