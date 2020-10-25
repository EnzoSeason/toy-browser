function getStyle(element) {
    if (!element.style) {
      element.style = {};
    }
    for (const prop in element.computedStyle) {
      element.style[prop] = element.computedStyle[prop].value;
      const value = element.style[prop].toString();
      if (value.match(/px$/)) {
        element.style[prop] = parseInt(value);
      }
      if (value.match(/^[0-9\.]+$/)) {
        element.style[prop] = parseInt(value);
      }
    }
    return element.style;
}

function layout(element) {
    if (!element.computedStyle) {
        return;
    }
    let elementStyle = getStyle(element);
  
    if (elementStyle.display !== 'flex') {
        return;
    }
    let items = element.children.filter((e) => e.type === 'element');
  
    items.sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
    });

    ['width', 'height'].forEach((size) => {
        if (elementStyle[size] === 'auto' || elementStyle[size] === '') {
            elementStyle[size] = null;
        }
    });

    if (!elementStyle.flexDirection || elementStyle.flexDirection === 'auto') {
        elementStyle.flexDirection = 'row';
    }
    if (!elementStyle.alignItems || elementStyle.alignItems === 'auto') {
        elementStyle.alignItems = 'stretch';
    }
    if (!elementStyle.justifyContent || elementStyle.justifyContent === 'auto') {
        elementStyle.justifyContent = 'flex-start';
    }
    if (!elementStyle.flexWrap || elementStyle.flexWrap === 'auto') {
        elementStyle.flexWrap = 'nowrap';
    }
    if (!elementStyle.alignContent || elementStyle.alignContent === 'auto') {
        elementStyle.alignContent = 'stretch';
    }
  
    let mainSize,
        mainStart,
        mainEnd,
        mainSign,
        mainBase,
        crossSize,
        crossStart,
        crossEnd,
        crossSign,
        crossBase;
    if (elementStyle.flexDirection === 'row') {
        mainSize = 'width';
        mainStart = 'left';
        mainEnd = 'right';
        mainSign = +1; // left to right
        mainBase = 0; // start point
    
        crossSize = 'height';
        crossStart = 'top';
        crossEnd = 'bottom';
    }
  
    if (elementStyle.flexDirection === 'row-reverse') {
        mainSize = 'width';
        mainStart = 'right';
        mainEnd = 'left';
        mainSign = -1;
        mainBase = elementStyle.width;
  
        crossSize = 'height';
        crossStart = 'top';
        crossEnd = 'bottom';
    }
  
    if (elementStyle.flexDirection === 'column') {
        mainSize = 'height';
        mainStart = 'top';
        mainEnd = 'bottom';
        mainSign = +1;
        mainBase = 0;
    
        crossSize = 'width';
        crossStart = 'letf';
        crossEnd = 'right';
    }
  
    if (elementStyle.flexDirection === 'column-reverse') {
        mainSize = 'height';
        mainStart = 'top';
        mainEnd = 'bottom';
        mainSign = -1;
        mainBase = elementStyle.height;
    
        crossSize = 'width';
        crossStart = 'letf';
        crossEnd = 'right';
    }
  
    if (elementStyle.flexWrap === 'wrap-reverse') {
        const tmp = crossStart;
        crossStart = crossEnd;
        crossEnd = tmp;
        crossSign = -1;
    } else {
        crossSign = 1;
        crossBase = 0;
    }

    let isAutoMainSize = false;
    // if the main size is not set, use no-wrap 
    // set all the items in one row
    if (!elementStyle[mainSize]) {
        elementStyle[mainSize] = 0;
        for (let i = 0; i < items.length; i++) {
                const item = items[i];
                let itemStyle = getStyle(item);
                if (itemStyle[mainSize] !== null || itemStyle[mainSize]) {
                    elementStyle[mainSize] = elementStyle[mainSize] + item[mainSize];
                }
        }
        isAutoMainSize = true;
    }

    // save flex container into flexLines
    let flexLine = [];
    let flexLines = [flexLine];
    // init mainSpace, crossSpace
    let mainSpace = elementStyle[mainSize];
    let crossSpace = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let itemStyle = getStyle(item);
        if (itemStyle[mainSize] === null) {
            itemStyle[mainSize] = 0;
        }
        // set crossSpace
        if (itemStyle[crossSize] !== null && itemStyle[crossSize] !== void 0) {
            crossSpace = Math.max(crossSpace, itemStyle[crossSize]);
        }
        // if item has flex style, then item must be placed inline.
        if (itemStyle.flex) {
            flexLine.push(item);
        } else if (elementStyle.flexWrap === 'nowrap' && isAutoMainSize) {
            // place item inline
            mainSpace -= itemStyle[mainSize];

            flexLine.push(item);
        } else { // may need change line
            // shrink item size to fit mainSpace size
            if (itemStyle[mainSize] > elementStyle[mainSize]) {
                itemStyle[mainSize] = elementStyle[mainSize];
            }

            // change line
            if (mainSpace < itemStyle[mainSize]) {
                flexLine.mainSpace = mainSpace;
                flexLine.crossSpace = crossSpace;

                flexLine = [item];
                flexLines.push(flexLine);
                
                mainSpace = elementStyle[mainSize];
                crossSpace = 0;
            } else {
                flexLine.push(item);
            }

            if (itemStyle[crossSize] !== null && itemStyle[crossSize] !== void 0) {
                crossSpace = Math.max(crossSpace, itemStyle[crossSize]);
            }
            mainSpace -= itemStyle[mainSize];
        }
    }
    
    // reset mainSpace and crossSpace for next item
    flexLine.mainSpace = mainSpace;
    if (elementStyle.flexWrap === "nowrap" || isAutoMainSize) {
        flexLine.crossSpace = (elementStyle[crossSize] === void 0) ? crossSpace : elementStyle[crossSize];
    } else {
        flexLine.crossSpace = crossSpace;
    }

    // calculate main axis
    // read flex, justify-content
    if (mainSpace < 0) {
        // scale main space and items' main size
        let scale = elementStyle[mainSize] / (elementStyle[mainSize] - mainSpace);
        let currentMain = mainBase;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            let itemStyle = getStyle(item);
        
            if (itemStyle.flex) {
                itemStyle[mainSize] = 0;
            }

            itemStyle[mainSize] = itemStyle[mainSize] * scale;
            itemStyle[mainStart] = currentMain;
            itemStyle[mainEnd] = itemStyle[mainStart] * mainSign * itemStyle[mainSize];
            currentMain = itemStyle[mainEnd];
        }
    } else {
        flexLines.forEach((items) => {
            // get flex style
            let mainSpace = items.mainSpace;
            let flexTotal = 0;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                let itemStyle = getStyle(item);
                if (itemStyle.flex !== null && itemStyle.flex !== void 0) {
                    flexTotal += itemStyle.flex;
                    continue;
                }
            }
    
            if (flexTotal > 0) { // items have flex style
                let currentMain = mainBase;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    let itemStyle = getStyle(item);
                    if (itemStyle.flex) {
                        itemStyle[mainSize] = (mainSpace / flexTotal) * itemStyle.flex;
                    }
                    itemStyle[mainStart] = currentMain;
                    itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize];
                    currentMain = itemStyle[mainEnd];
                }
            } else { // items don't have flex style
                let currentMain = mainBase;
                let step = 0;
                if (style.justifyContent === 'flex-start') {
                    // defalut setting
                }
                if (style.justifyContent === 'flex-end') {
                    currentMain = mainSpace * mainSign + mainBase;
                }
        
                if (style.justifyContent === 'center') {
                    currensteptMain = (mainSpace / 2) * mainSign + mainBase;
                }
                if (style.justifyContent === 'space-between') {
                    step = (mainSpace / (items.length - 1)) * mainSign;
                }
                if (style.justifyContent === 'space-around') {
                    step = (mainSpace / items.length) * mainSign;
                    currentMain = step / 2 + mainBase;
                }
        
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    let itemStyle = getStyle(item);
                    itemStyle[mainStart] = currentMain;
                    itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize];
                    currentMain = itemStyle[mainEnd] + step;
                }
            }
        });
    }
    
    // calculate cross axis
    // read align-items, align-self

    // set crossSpace and elementStyle[crossSize]
    if (!elementStyle[crossSize]) {
        crossSpace = 0;
        elementStyle[crossSize] = 0;
        for (let i = 0; i < flexLines.length; i++) {
            elementStyle[crossSize] += flexLines[i].crossSpace;
        }
    } else {
        crossSpace = elementStyle[crossSize];
        for (let i = 0; i < flexLines.length; i++) {
            crossSpace -= flexLines[i].crossSpace || 0;
        }
    }
    // init crossBase
    if (elementStyle.flexWrap === 'wrap-reverse') {
        crossBase = style[crossSize];
    } else {
        crossBase = 0;
    }
    // set crossBase and step by align-content
    let step = 0;
    if (elementStyle.alignContent === 'flex-start') {
        crossBase += 0;
    }
    if (elementStyle.alignContent === 'flex-end') {
        crossBase += crossSign * crossSpace;
    }
    if (elementStyle.alignContent === 'center') {
        crossBase += (crossSign * crossSpace) / 2;
    }
    if (elementStyle.alignContent === 'space-between') {
        crossBase += 0;
        step = crossSpace / (flexLines.length - 1);
    }
    if (elementStyle.alignContent === 'space-around') {
        step = crossSpace / flexLines.length;
        crossBase += (crossSign * step) / 2;
    }
    if (elementStyle.alignContent === 'stretch') {
        crossBase += 0;
        step = 0;
    }

    flexLines.forEach((items) => {
        let lineCrossSize =
            elementStyle.alignContent === 'stretch'
                ? items.crossSpace + crossSpace / flexLines.length
                : items.crossSpace;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            let itemStyle = getStyle(item);
            // key line: align reads align-self and align-items (in parent element)
            // align-self has the higher priority
            let align = itemStyle.alignSelf || elementStyle.alignItems;
    
            if (!itemStyle[crossSize]) {
                itemStyle[crossSize] =
                    align === 'stretch' ? lineCrossSize : items.crossSpace;
            }
    
            if (align === 'flex-start') {
                itemStyle[crossStart] = crossBase;
                itemStyle[crossEnd] =
                    itemStyle[crossStart] + crossSign * itemStyle[crossSize];
            }
            if (align === 'flex-end') {
                itemStyle[crossEnd] = crossBase + crossSign * lineCrossSize;
                itemStyle[crossStart] =
                    itemStyle[crossEnd] - crossSign * itemStyle[crossSize];
            }
            if (align === 'center') {
                itemStyle[crossStart] =
                    crossBase + (crossSign * (lineCrossSize - itemStyle[crossSize])) / 2;
                itemStyle[crossEnd] =
                    itemStyle[crossStart] + crossSign * itemStyle[crossSize];
            }
            if (align === 'stretch') {
                itemStyle[crossStart] = crossBase;
                itemStyle[crossEnd] =
                    crossBase +
                    crossSign *
                        (itemStyle[crossSize] !== null && itemStyle[crossSize] !== void 0
                            ? itemStyle[crossSize]
                            : 0);
                itemStyle[crossSize] =
                    crossSign * (itemStyle[crossEnd] - itemStyle[crossStart]);
            }
        }
        crossBase += crossSign * (lineCrossSize + step);
    });
}
  
module.exports = layout;