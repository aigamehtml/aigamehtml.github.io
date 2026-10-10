/* 心理岛屿 · 测试页应用（React 无 JSX 版，读取 window.__SCALE_ID__） */
(function () {
  if (!window.PSY_SCALES || !window.__SCALE_ID__) return;
  var scale = window.PSY_SCALES[window.__SCALE_ID__];
  if (!scale) return;

  var h = React.createElement;
  var useState = React.useState;
  var useRef = React.useRef;
  var useEffect = React.useEffect;

  /* ---------- 基础组件 ---------- */

  function Button(props) {
    var cls = ['ai-btn', 'ai-btn-' + (props.type || 'default'), props.block ? 'ai-btn-block' : ''].filter(Boolean).join(' ');
    return h('button', {
      className: cls,
      onClick: props.onClick,
      disabled: props.disabled
    }, props.children);
  }

  function Progress(props) {
    var percent = Math.max(0, Math.min(100, props.percent || 0));
    return h('div', { className: 'ai-progress-row' },
      h('div', {
        className: 'ai-progress-track',
        role: 'progressbar',
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': Math.round(percent)
      },
        h('div', { className: 'ai-progress-fill', style: { width: percent + '%' } })
      ),
      h('span', { className: 'ai-progress-info' }, Math.round(percent) + '%')
    );
  }

  function RadioOption(props) {
    return h('div', {
      className: 'ai-radio' + (props.checked ? ' checked' : ''),
      onClick: props.onSelect
    },
      h('span', { className: 'ai-radio-box' },
        h('svg', { className: 'ai-radio-check', viewBox: '0 0 12 12', width: 14, height: 14 },
          h('path', { d: 'M2 6l3 3 5-5', fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })
        )
      ),
      h('span', { className: 'ai-radio-label' }, props.label)
    );
  }

  function Modal(props) {
    if (!props.open) return null;
    return h('div', { className: 'ai-modal-mask', onClick: props.onClose },
      h('div', { className: 'ai-modal', onClick: function (e) { e.stopPropagation(); } },
        h('button', { className: 'ai-modal-close', onClick: props.onClose, 'aria-label': '关闭' }),
        h('div', { className: 'ai-modal-title' }, props.title),
        h('div', { className: 'ai-modal-body' }, props.children)
      )
    );
  }

  /* ---------- 计分逻辑 ---------- */

  function computeResult(answers) {
    if (scale.type === 'zung') {
      var raw = 0;
      answers.forEach(function (v, i) {
        var score = v + 1; // 选项 0-3 -> 1-4 分
        if (scale.reverse.indexOf(i + 1) !== -1) score = 5 - score;
        raw += score;
      });
      var standard = Math.floor(raw * 1.25);
      var level = scale.levels[scale.levels.length - 1];
      for (var j = 0; j < scale.levels.length; j++) {
        if (standard <= scale.levels[j].max) { level = scale.levels[j]; break; }
      }
      return { type: 'zung', raw: raw, standard: standard, level: level };
    }

    if (scale.type === 'ais') {
      var total = 0;
      answers.forEach(function (v) { total += v; }); // 选项 0-3 即得分
      var levelA = scale.levels[scale.levels.length - 1];
      for (var k = 0; k < scale.levels.length; k++) {
        if (total <= scale.levels[k].max) { levelA = scale.levels[k]; break; }
      }
      return { type: 'ais', total: total, level: levelA };
    }

    if (scale.type === 'scl90') {
      var totalS = 0, positiveCount = 0, positiveTotal = 0;
      answers.forEach(function (v) {
        var s = v + 1; // 1-5
        totalS += s;
        if (s >= 2) { positiveCount++; positiveTotal += s; }
      });
      var factorScores = scale.factors.map(function (f) {
        var sum = 0;
        f.items.forEach(function (no) { sum += answers[no - 1] + 1; });
        return { name: f.name, score: sum / f.items.length, norm: f.norm };
      });
      var isPositive = totalS > 160 || positiveCount > 43 || factorScores.some(function (f) { return f.score > 2; });
      return {
        type: 'scl90',
        total: totalS,
        totalMean: totalS / 90,
        positiveCount: positiveCount,
        positiveMean: positiveCount > 0 ? positiveTotal / positiveCount : 0,
        factorScores: factorScores,
        positive: isPositive
      };
    }

    if (scale.type === 'bfi') {
      var bfiScores = scale.factors.map(function (f) {
        var sum = 0;
        f.items.forEach(function (no) {
          var score = answers[no - 1] + 1; // 1-5
          if (scale.reverse.indexOf(no) !== -1) score = 6 - score;
          sum += score;
        });
        return { key: f.key, name: f.name, score: sum / f.items.length, desc: f.desc };
      });
      return { type: 'bfi', factorScores: bfiScores };
    }

    if (scale.type === 'fun-cat') {
      var counts = {};
      scale.categories.forEach(function (c) { counts[c.key] = 0; });
      answers.forEach(function (v, i) {
        var opt = scale.items[i].options[v];
        if (opt && opt.key) counts[opt.key]++;
      });
      var top = scale.categories[0];
      scale.categories.forEach(function (c) { if (counts[c.key] > counts[top.key]) top = c; });
      return { type: 'fun-cat', top: top, counts: counts, categories: scale.categories };
    }

    if (scale.type === 'fun-score') {
      var totalF = 0;
      answers.forEach(function (v, i) {
        var opt = scale.items[i].options[v];
        if (opt && typeof opt.score === 'number') totalF += opt.score;
      });
      var levelF = scale.levels[scale.levels.length - 1];
      for (var m = 0; m < scale.levels.length; m++) {
        if (totalF <= scale.levels[m].max) { levelF = scale.levels[m]; break; }
      }
      return { type: 'fun-score', total: totalF, level: levelF };
    }

    return { type: 'unknown' };
  }

  function levelTag(level) {
    return h('span', { className: 'level-tag' }, level.label);
  }

  /* ---------- 结果页 ---------- */

  function FactorBar(props) {
    var widthPct = (props.score / props.max) * 100;
    var normPct = props.norm ? (props.norm / props.max) * 100 : null;
    return h('div', { className: 'factor-row' },
      h('div', { className: 'factor-head' },
        h('span', { className: 'factor-name' }, props.name + (props.sub ? ' · ' + props.sub : '')),
        h('span', { className: 'factor-val' }, props.score.toFixed(2) + (props.max ? ' / ' + props.max : ''))
      ),
      h('div', { className: 'factor-track' },
        h('div', { className: 'factor-fill', style: { width: widthPct + '%' } }),
        normPct !== null ? h('div', { className: 'factor-norm-line', style: { left: normPct + '%' }, title: '常模 ' + props.norm }) : null
      ),
      props.desc ? h('div', { className: 'factor-desc' }, props.desc) : null
    );
  }

  /* 趣味测评：分类计数条 */
    function CountBar(props) {
      var pct = (props.count / props.max) * 100;
      return h('div', { className: 'factor-row' },
        h('div', { className: 'factor-head' },
          h('span', { className: 'factor-name' }, props.name),
          h('span', { className: 'factor-val' }, props.count + ' / ' + props.max)
        ),
        h('div', { className: 'factor-track' },
          h('div', { className: 'factor-fill', style: { width: pct + '%' } })
        )
      );
    }

    function ResultView(props) {
    var r = props.r;
    var actions = h('div', { className: 'result-actions' },
      h(Button, { type: 'primary', block: true, onClick: props.onRestart }, '再测一次'),
      h(Button, { type: 'default', block: true, onClick: function () { location.href = 'index.html'; } }, '返回首页')
    );

    if (r.type === 'zung') {
      return h('div', { className: 'result-wrap' },
        h('div', { className: 'ai-card result-hero' },
          h('div', { className: 'score-label' }, '标准分（粗分 × 1.25）'),
          h('div', { className: 'score-big' }, String(r.standard)),
          h('div', { className: 'score-unit' }, '原始分：' + r.raw),
          h('div', {}, levelTag(r.level)),
          h('div', { className: 'level-desc' }, r.level.desc)
        ),
        h('div', { className: 'ai-card ai-card-dashed result-section' },
          h('div', { className: 'section-title' }, '分数说明'),
          h('div', { className: 'factor-desc' }, 'SDS/SAS 标准分 = 各题得分之和 × 1.25 后取整数。' +
            '标准分 <50 为正常范围；50-59 轻度；60-69 中度；≥70 重度。' +
            '本结果仅为自评筛查参考，不能替代专业诊断。')
        ),
        actions
      );
    }

    if (r.type === 'ais') {
      return h('div', { className: 'result-wrap' },
        h('div', { className: 'ai-card result-hero' },
          h('div', { className: 'score-label' }, 'AIS 总分（满分 24 分）'),
          h('div', { className: 'score-big' }, String(r.total)),
          h('div', { className: 'score-unit' }, '8 个条目得分之和'),
          h('div', {}, levelTag(r.level)),
          h('div', { className: 'level-desc' }, r.level.desc)
        ),
        h('div', { className: 'ai-card ai-card-dashed result-section' },
          h('div', { className: 'section-title' }, '分数说明'),
          h('div', { className: 'factor-desc' }, 'AIS 总分 0-24 分：0-3 分无睡眠障碍；4-6 分可疑失眠（轻度）；7-10 分中度失眠；≥11 分重度失眠。本结果仅供参考，不替代医学诊断。')
        ),
        actions
      );
    }

    if (r.type === 'scl90') {
      return h('div', { className: 'result-wrap' },
        h('div', { className: 'ai-card result-hero' },
          h('div', { className: 'score-label' }, 'SCL-90 筛查结果'),
          h('div', { style: { marginTop: 8 } },
            h('span', { className: 'screen-tag ' + (r.positive ? 'positive' : 'negative') },
              r.positive ? '筛查阳性 · 建议进一步评估' : '筛查阴性')
          ),
          h('div', { className: 'level-desc' },
            r.positive
              ? '总分、阳性项目数或部分因子分超出筛查标准，建议前往专业机构进一步评估。'
              : '各项指标在常规筛查范围内，请继续保持健康的生活方式。')
        ),
        h('div', { className: 'ai-card ai-card-dashed result-section' },
          h('div', { className: 'section-title' }, '总体指标'),
          h('div', { className: 'summary-grid' },
            h('div', { className: 'summary-item' }, h('div', { className: 'si-label' }, '总分'), h('div', { className: 'si-value' }, String(r.total)), h('div', { className: 'si-note' }, '>160 为筛查阳性') ),
            h('div', { className: 'summary-item' }, h('div', { className: 'si-label' }, '总均分'), h('div', { className: 'si-value' }, r.totalMean.toFixed(2)), h('div', { className: 'si-note' }, '总分 / 90') ),
            h('div', { className: 'summary-item' }, h('div', { className: 'si-label' }, '阳性项目数'), h('div', { className: 'si-value' }, String(r.positiveCount)), h('div', { className: 'si-note' }, '>43 为筛查阳性') ),
            h('div', { className: 'summary-item' }, h('div', { className: 'si-label' }, '阳性症状均分'), h('div', { className: 'si-value' }, r.positiveMean.toFixed(2)), h('div', { className: 'si-note' }, '阳性项目总分 / 项数') )
          )
        ),
        h('div', { className: 'ai-card ai-card-dashed result-section' },
          h('div', { className: 'section-title' }, '九大因子分（红线为成人常模均值）'),
          r.factorScores.map(function (f) {
            return h(FactorBar, { key: f.name, name: f.name, score: f.score, max: 5, norm: f.norm });
          }),
          h('div', { className: 'legend' }, '常模（M）：躯体化 1.37 · 强迫 1.62 · 人际 1.65 · 抑郁 1.50 · 焦虑 1.39 · 敌对 1.46 · 恐怖 1.23 · 偏执 1.43 · 精神病性 1.29。任一因子分 >2 提示该维度需关注。')
        ),
        actions
      );
    }

    if (r.type === 'bfi') {
      return h('div', { className: 'result-wrap' },
        h('div', { className: 'ai-card result-hero' },
          h('div', { className: 'score-label' }, '你的大五人格画像'),
          h('div', { className: 'level-desc' }, '每个维度得分范围 1-5 分，3 分代表中等水平。得分越高，该特质越明显。')
        ),
        h('div', { className: 'ai-card ai-card-dashed result-section' },
          r.factorScores.map(function (f) {
            return h(FactorBar, { key: f.key, name: f.name, sub: f.key, score: f.score, max: 5, desc: f.desc });
          })
        ),
        actions
      );
    }

    if (r.type === 'fun-cat') {
        return h('div', { className: 'result-wrap' },
          h('div', { className: 'ai-card result-hero' },
            h('div', { className: 'score-label' }, '你的结果是'),
            h('div', { className: 'fun-type-title' }, r.top.title),
            h('div', { className: 'level-desc' }, r.top.desc),
            h('div', { className: 'fun-advice' }, '小建议：' + r.top.advice)
          ),
          h('div', { className: 'ai-card ai-card-dashed result-section' },
            h('div', { className: 'section-title' }, '各类型分布'),
            r.categories.map(function (c) {
              return h(CountBar, { key: c.key, name: c.title, count: r.counts[c.key], max: scale.items.length });
            })
          ),
          h('div', { className: 'ai-card ai-card-dashed result-section' },
            h('div', { className: 'section-title' }, '其他类型速览'),
            r.categories.filter(function (c) { return c.key !== r.top.key; }).map(function (c) {
              return h('div', { key: c.key, className: 'mini-type' },
                h('span', { className: 'mini-type-name' }, c.title),
                h('span', { className: 'mini-type-desc' }, c.desc)
              );
            })
          ),
          actions
        );
      }

      if (r.type === 'fun-score') {
        return h('div', { className: 'result-wrap' },
          h('div', { className: 'ai-card result-hero' },
            h('div', { className: 'score-label' }, '孤独等级 · 满分 ' + scale.levels[scale.levels.length - 1].max + ' 分'),
            h('div', { className: 'score-big' }, String(r.total)),
            h('div', {}, levelTag(r.level)),
            h('div', { className: 'level-desc' }, r.level.desc),
            h('div', { className: 'fun-advice' }, '小建议：' + r.level.advice)
          ),
          h('div', { className: 'ai-card ai-card-dashed result-section' },
            h('div', { className: 'section-title' }, '分数说明'),
            h('div', { className: 'factor-desc' }, '每题按「几乎不会 0 分 / 偶尔会 1 分 / 经常这样 2 分」计分，总分越高代表孤独感受越强。本测评仅供娱乐，不构成心理评估。')
          ),
          actions
        );
      }

      return actions;
  }

  /* ---------- 答题页 ---------- */

  function TestPage() {
    var qs = scale.items;
    var isAis = scale.type === 'ais';
    var [index, setIndex] = useState(0);
    var [answers, setAnswers] = useState(Array(qs.length).fill(null));
    var [phase, setPhase] = useState('quiz');
    var [showInfo, setShowInfo] = useState(false);
    var timer = useRef(null);

    useEffect(function () {
      return function () { if (timer.current) clearTimeout(timer.current); };
    }, []);

    useEffect(function () {
      if (phase === 'result') window.scrollTo(0, 0);
    }, [phase]);

    var current = index;
    var answer = answers[current];

    function clearTimer() { if (timer.current) { clearTimeout(timer.current); timer.current = null; } }

    function select(v) {
      var next = answers.slice();
      next[current] = v;
      setAnswers(next);
      clearTimer();
      timer.current = setTimeout(function () {
        if (current < qs.length - 1) setIndex(current + 1);
        else setPhase('result');
      }, 320);
    }

    function goPrev() {
      clearTimer();
      if (current > 0) setIndex(current - 1);
    }

    function goNext() {
      if (answer === null) return;
      clearTimer();
      if (current < qs.length - 1) setIndex(current + 1);
      else setPhase('result');
    }

    function restart() {
      clearTimer();
      setAnswers(Array(qs.length).fill(null));
      setIndex(0);
      setPhase('quiz');
    }

    if (phase === 'result') {
      var result = computeResult(answers);
      return h('div', { className: 'app' },
        h('div', { className: 'topbar' },
          h('div', { className: 'topbar-title' },
            h('span', { className: 'topbar-abbr' }, scale.abbr),
            h('span', { className: 'topbar-name' }, scale.name + ' · 测评结果')
          )
        ),
        h(ResultView, { r: result, onRestart: restart })
      );
    }

    var opts = qs[current].options || scale.options;
    var answeredCount = answers.filter(function (a) { return a !== null; }).length;
    var percent = (answeredCount / qs.length) * 100;

    var infoContent = h('div', {},
      h('p', { style: { marginBottom: 10 } }, scale.source),
      h('p', { style: { marginBottom: 10 } }, scale.intro || '请根据你的实际情况，选择最符合的一项。答案没有对错之分，凭第一感觉作答即可。'),
      h('p', {}, '测试结果仅作自评筛查参考，不构成医学诊断。如有困扰，请及时寻求专业帮助。')
    );

    return h('div', { className: 'app' },
      h('div', { className: 'topbar' },
        h('button', { className: 'icon-btn back-btn', onClick: goPrev, disabled: current === 0, 'aria-label': '上一题' }),
        h('div', { className: 'topbar-title' },
          h('span', { className: 'topbar-abbr' }, scale.abbr),
          h('span', { className: 'topbar-name' }, scale.name)
        ),
        h('button', { className: 'icon-btn', onClick: function () { setShowInfo(true); } }, '说明'),
        h('button', { className: 'icon-btn', onClick: restart }, '重测')
      ),
      h(Progress, { percent: percent }),
      h('div', { className: 'ai-card ai-card-dashed question-card' },
        h('div', { className: 'question-num' }, '第 ' + (current + 1) + ' / ' + qs.length + ' 题'),
        h('div', { className: 'question-text' }, (typeof qs[current] === 'string' ? qs[current] : qs[current].text)),
        h('div', { className: 'option-list' },
          opts.map(function (o, i) {
            return h(RadioOption, { key: i, label: (typeof o === 'string' ? o : o.text), checked: answer === i, onSelect: function () { select(i); } });
          })
        )
      ),
      h('div', { className: 'nav-row' },
        h(Button, { type: 'default', onClick: goPrev, disabled: current === 0 }, '上一题'),
        h(Button, { type: 'primary', onClick: goNext, disabled: answer === null }, current < qs.length - 1 ? '下一题' : '查看结果')
      ),
      h(Modal, { open: showInfo, onClose: function () { setShowInfo(false); }, title: scale.name + ' · 说明' }, infoContent)
    );
  }

  /* ---------- 调试出口（可选） ---------- */
  window.__PSY_DEBUG__ = { computeResult: computeResult, scale: scale };

  /* ---------- 挂载 ---------- */
  var rootEl = document.getElementById('root');
  if (rootEl) {
    ReactDOM.createRoot(rootEl).render(h(TestPage, null));
  }
})();