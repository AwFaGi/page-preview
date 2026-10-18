# page-preview

Веб-компонент `<page-preview>`: загружает HTML-страницу по адресу из атрибута `src`
и показывает компактную карточку со ссылкой на неё, названием документа (`<title>`)
и текстом первого заголовка `<h1>`.

Без зависимостей, обычный ES-модуль. Импорт пакета сам регистрирует элемент.

## Установка

```sh
npm install @awfagi/page-preview
```

## Использование

Со сборщиком (Vite, webpack и т. п.):

```js
import '@awfagi/page-preview';
```

```html
<page-preview src="/pages/example.html"></page-preview>
```

Без сборщика, через import map:

```html
<script type="importmap">
  { "imports": { "@awfagi/page-preview": "/node_modules/@awfagi/page-preview/src/page-preview.js" } }
</script>
<script type="module">import '@awfagi/page-preview';</script>

<page-preview src="./example.html"></page-preview>
```

Или напрямую по относительному пути: `<script type="module" src="./src/page-preview.js"></script>`.

Класс тоже экспортируется: `import { PagePreview } from '@awfagi/page-preview';`.

## Интерфейс

| Что | Описание |
| --- | --- |
| атрибут / свойство `src` | Адрес HTML-документа. Относительный адрес разрешается относительно страницы с компонентом. При изменении загружается новая страница. |
| `data-status` | Ставится на сам элемент: `loading`, `ready` или `error`. |
| `::part(link)` | `<a>` с полным адресом страницы. Текст ссылки — название документа, а если его нет, то URL. |
| `::part(title)` | `<span>` с `document.title.trim()` или текстом «Название отсутствует». |
| `::part(heading)` | `<span>` с `textContent.trim()` первого `<h1>` или текстом «Заголовок отсутствует». |
| `::part(card)`, `::part(url)`, `::part(status)` | Обёртка карточки, строка с адресом и сообщение о состоянии или ошибке. |

Состояние `error` ставится при HTTP-ошибке, сетевой ошибке, отсутствующем или некорректном `src`.
Исключения наружу не выбрасываются.

Страница из `src` должна быть доступна браузерному `fetch`: тот же origin или разрешающие
CORS-заголовки. Чужие сайты обычно запрещают чтение своего HTML, и тогда компонент покажет ошибку.

Внешний вид можно настроить снаружи через `::part`:

```css
page-preview::part(card) { border-radius: 0; }
page-preview::part(link) { color: rebeccapurple; }
```

## Разработка

```sh
npm start            # http://localhost:8000/demo/
```

`scripts/serve.mjs` — простой статический сервер. Параметр `?delay=<мс>` задерживает ответ,
это нужно для проверки быстрого переключения `src`. Подойдёт и `python -m http.server 8000`,
но без задержек.

## Лицензия

MIT
