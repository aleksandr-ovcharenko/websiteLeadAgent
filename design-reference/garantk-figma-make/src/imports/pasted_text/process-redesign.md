Redesign ONLY the section:

“Как мы работаем”
“Этапы реализации проекта”

The current version is too dry:
01 Проектирование
02 Подготовительные работы
03 Строительство
04 Монтаж
05 Сдача объекта

Turn this into a premium, visually engaging architectural process section.

IMPORTANT:
Do not change the rest of the homepage.

==================================================
GOAL
==================================================

The section should:

1. explain how the company delivers a project;
2. visually communicate a structured professional process;
3. encourage users to explore the relevant service pages;
4. feel like part of a premium construction / architecture website;
5. avoid looking like a simple numbered list or SaaS steps component.

==================================================
STRUCTURE
==================================================

Use these five stages:

01
Проектирование

02
Подготовительные работы

03
Строительство

04
Монтаж

05
Сдача объекта

Each stage must include:

- large step number;
- title;
- concise 1–2 line description;
- small CTA / link:
  “Подробнее →”
- clear indication that the item is clickable.

The ENTIRE stage item may be clickable.

==================================================
LINKING / INFORMATION ARCHITECTURE
==================================================

Each stage should link to the most relevant internal CMS page.

Preferred mapping:

01 Проектирование
→ /services/proektirovanie

02 Подготовительные работы
→ /services/podgotovitelnye-raboty

03 Строительство
→ /services/obshchestroitelnye-raboty

04 Монтаж
→ /services/montazh-stroitelnyh-konstruktsiy

05 Сдача объекта
→ /process/sdacha-obekta
or another relevant CMS page if such content exists.

IMPORTANT:
Do not invent factual service information.

If a dedicated page does not yet exist,
design the component so the CMS can later assign any internal Page or Service URL.

The link target must therefore be dynamic CMS data, not hardcoded into the visual component.

==================================================
COPY DIRECTION
==================================================

Use concise copy such as:

01 — Проектирование
Разрабатываем решения и проектную документацию с учётом задач объекта.
Подробнее →

02 — Подготовительные работы
Подготавливаем площадку и выполняем необходимые работы перед началом строительства.
Подробнее →

03 — Строительство
Выполняем комплекс общестроительных работ и координируем реализацию проекта.
Подробнее →

04 — Монтаж
Осуществляем монтаж строительных конструкций и инженерно связанных элементов.
Подробнее →

05 — Сдача объекта
Завершаем работы, проверяем результат и подготавливаем объект к передаче заказчику.
Подробнее →

Keep copy short.
Do not add unsupported claims, durations, guarantees or statistics.

==================================================
VISUAL DIRECTION
==================================================

Make the section feel architectural and editorial.

Avoid:
- five generic rounded cards;
- icon circles;
- SaaS stepper UI;
- excessive shadows;
- cartoon illustrations;
- generic checkmarks.

Preferred direction:

Desktop:
a strong horizontal architectural timeline or asymmetric grid.

Use:
- large numbers 01–05;
- thin structural lines;
- restrained use of brand green;
- generous whitespace;
- strong typography;
- subtle image fragments or architectural details where useful;
- arrows or connecting lines showing progression.

The section should visually communicate:

01 → 02 → 03 → 04 → 05

but without looking like a PowerPoint diagram.

==================================================
INTERACTION
==================================================

Desktop hover:

- stage title or number slightly shifts/highlights;
- underline / arrow animates subtly;
- optional relevant image preview changes;
- cursor clearly indicates link.

No excessive animations.

==================================================
OPTIONAL STRONGER COMPOSITION
==================================================

Consider a split layout:

LEFT:
large heading

“От идеи
до готового объекта”

short intro text

RIGHT:
five interactive stages

or:

top:
heading

bottom:
large numbered process timeline.

Another acceptable direction:

one large featured stage + four compact stages,
where hovering a stage updates an architectural image.

Choose the composition that feels most premium.

==================================================
MOBILE
==================================================

Do NOT just squeeze the horizontal desktop timeline.

Create an intentional vertical mobile version:

01
Проектирование
description
Подробнее →

│

02
Подготовительные работы
description
Подробнее →

│

...

Use a subtle vertical line to connect the stages.

Keep:
- large readable numbers;
- strong spacing;
- minimum 44px touch targets;
- entire stage easy to tap.

==================================================
CMS REQUIREMENT
==================================================

This must become a reusable CMS block:

ProcessBlock

Each item should conceptually support:

{
  number,
  title,
  description,
  linkLabel,
  linkTarget
}

Do not make the content specific to this exact page implementation.

==================================================
QUALITY BAR
==================================================

The result should feel like a section from a professional European construction or architecture company.

It should help the user understand that the company has a clear full-cycle process, while also naturally directing the visitor toward deeper service pages.

Do not finish until it looks significantly more sophisticated than a simple list of five numbered items.