Когда появятся ручки conspectus, добавь сюда файл, например create.py, по образцу
../user/create.py:

  GROUP = "conspectus"
  MIX = { "conspectus.create.ok": 1.0 }
  SCENARIOS = { ... }

И добавь долю "conspectus" в ../weights.py (GROUP_WEIGHTS), уменьшив другие группы.
