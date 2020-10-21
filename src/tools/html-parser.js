const EOF = Symbol("EOF");
const css = require('css');
const layout = require('./layout.js');

let currentToken = null;
let currentAttribute = null;
let currentTextNode = null;
let stack = [{ type: 'document', children: [] }];
let rules = [];

function addCSSRules(text) {
	let ast = css.parse(text);
	rules.push(...ast.stylesheet.rules);
}

function specificity(selector) {
	let p = [0, 0, 0, 0]; // inline style, id, class, tag
	let selectorParts = selector.split(" ");
	for (let part of selectorParts) {
		if (part.charAt(0) === "#") {
			p[1] += 1;
		} else if (part.charAt(0) === ".") {
			p[2] += 1;
		} else {
			p[3] += 1;
		}
	}
	return p;
}

function compare(sp1, sp2) {
	for (let i = 0; i < 3; i++) {
		if (sp1[i] - sp2[i]) {
			return sp1[i] - sp2[i];
		}
	}
	return sp1[3] - sp2[3];
}


/**
 * 3 types of selectors: div .a #b
 * 
 * @param {*} element 
 * @param {*} selector 
 */
function match(element, selector) {
	if (!selector || !element.attributes) {
		return false;
	}

	if (selector.charAt(0) === "#") {
		let attr = element.attributes.filter(attr => attr.name === "id")[0];
		if (attr && attr.value === selector.replace("#", "")) {
			return true;
		}
	} else if (selector.charAt(0) === ".") {
		let attr = element.attributes.filter(attr => attr.name === "class")[0];
		if (attr && attr.value === selector.replace(".", "")) {
			return true;
		}
	} else {
		if (element.tagName === selector) {
			return true;
		}
	}
	return false;
}

function computedCSS(element) {
	let elements = stack.slice().reverse();

	if (!element.computedStyle) {
		element.computedStyle = {};
	}

	for (let rule of rules) {
		let selectorParts = rule.selectors[0].split(" ").reverse();

		if (!match(element, selectorParts[0])) {
			continue;
		}

		let matched = false
		
		let j = 1; // index of selectorParts
		for (let i = 0; i < elements.length; i++) {
			if (match(elements[i], selectorParts[j])) {
				j++;
			}
		}
		if (j >= selectorParts.length) {
			matched = true;
		}

		if (matched) {
			let sp = specificity(rule.selectors[0]);
			let computedStyle = element.computedStyle;
			for (let declaration of rule.declarations) {
				if (!computedStyle[declaration.property]) {
					computedStyle[declaration.property] = {};
				}

				if (!computedStyle[declaration.property].specificity) {
					computedStyle[declaration.property].value = declaration.value;
					computedStyle[declaration.property].specificity = sp;
				} else if (compare(sp, computedStyle[declaration.property].specificity) < 0) {
					// current specificity is higher than accent one, overwrite css
					computedStyle[declaration.property].value = declaration.value;
					computedStyle[declaration.property].specificity = sp;
				}
				
			}
		}
	}
}

function emit(token) {
	// console.log(token)
	let top = stack[stack.length - 1];
	if (token.type === 'startTag') { // add new element into DOM tree
		let element = {
			type: 'element',
			attributes: [],
			children: [],
		}
		element.tagName = token.tagName;
		for (let p in token) {
			if (p !== 'type' && p !== 'tagName') {
				element.attributes.push({
					name: p,
					value: token[p],
				});
			}
		}
		computedCSS(element);
		
		top.children.push(element);

		if (!token.isSelfClosing) {
			stack.push(element);
		}

		currentTextNode = null;

	} else if (token.type === 'text') { // add TextNode into element's children in DOM tree
		if (currentTextNode === null) {
			currentTextNode = {
				type: 'text',
				content: '',
			}
			top.children.push(currentTextNode);
		}
		currentTextNode.content += token.content;
	} else if (token.type === 'endTag') { // compute css, create layout
		if (top.tagName !== token.tagName) {
			throw new Error(top.tagName + '!==' + token.tagName)
		} else {
			if (top.tagName === 'style') {
				addCSSRules(currentTextNode.content)
			}
			// css layout
			layout(top);
			// All the TextNodes and css rules is readed. pop it.
			// last element is added into DOM tree as a child (top.children.push(element)).
			// in the end, there is only one node is stack (the root of the DOM tree)
			stack.pop()
		}
		currentTextNode = null
	}
}

function data(c) {
    if (c === "<") {
        return tagOpen;
    }
    
    if (c === EOF) {
        emit({
            type: 'EOF'
        });
        return;
    } 
    emit({
        type: 'text',
        content: c
    });
    return data;
}

function tagOpen(c) {
    // </
    if (c === "/") {
        return endTagOpen;
    }

    // <p 
    if (c.match(/^[a-zA-Z]$/)) {
        currentToken = {
            type: 'startTag',
            tagName: ''
        };
        return tagName(c);
    }

    return data(c);
}

function endTagOpen(c) {
    // </p
    if (c.match(/^[a-zA-Z]$/)) {
        currentToken = {
            type: 'endTag',
            tagName: ''
        };
        return tagName(c);
    }

    // </>, error
    if (c === ">") {

    }

    // </[EOF], error
    if (c === EOF) {

    }

    // other errors
}

function tagName(c) {
    // space
    if (c.match(/^[\t\n\f\s]$/)) {
        return beforeAttributeName;
    }

    if (c === "/") {
        return selfClosingStartTag;
    }

    if (c === ">") {
        emit(currentToken);
        return data;
    }

    if (c.match(/^[a-zA-Z]$/)) {
		currentToken.tagName += c;
        return tagName;
    }
	currentToken.tagName += c;
    return tagName;
}

function beforeAttributeName(c) {
	if (c.match(/^[\t\n\f ]$/)) {
		return beforeAttributeName
	} else if (c === '/' || c === '>' || c === EOF) {
		return afterAttributeName
	} else if (c === '=') {
	} else {
		currentAttribute = {
			name: '',
			value: '',
		}
		return attributeName(c)
	}
}

function afterAttributeName(c) {
	if (c.match(/^[\t\n\f ]$/)) {
		return afterAttributeName;
	} else if (c === '/') {
		return selfClosingStartTag
	} else if (c === '>') {
		currentToken[currentAttribute.name] = currentAttribute.value;
		emit(currentToken);
	} else if (c === EOF) {
	} else if (c === '=') {
		return beforeAttributeValue
	} else {
		currentToken[currentAttribute.name] = currentAttribute.value;
		currentAttribute = {
			name: "",
			value: ""
		}
		return afterAttributeName(c);
	}
}

function attributeName(c) {
	if (c.match(/^[\t\n\f ]$/) || c === '/' || c === '>' || c === EOF) {
		return afterAttributeName(c)
	} else if (c === '=') {
		return beforeAttributeValue
	} else if (c === '\u0000') {
	} else if (c === '"' || c === "'" || c === '<') {
	} else {
		currentAttribute.name += c
		return attributeName
	}
}

function beforeAttributeValue(c) {
	if (c.match(/^[\t\n\f ]$/) || c === '/' || c === EOF) {
		return beforeAttributeValue
	} else if (c === '"') {
		return doubleQuotedAttributeValue
	} else if (c === "'") {
		return singleQuotedAttributeValue
	} else if ( c === '>') {
		return data
	} else {
		return UnquotedAttributeValue(c)
	}
}

function doubleQuotedAttributeValue(c) {
	if (c === '"') {
		currentToken[currentAttribute.name] = currentAttribute.value
		return afterQuotedAttributeValue
	} else if (c === '\u0000') {
	} else if (c === EOF) {
	} else {
		currentAttribute.value += c
		return doubleQuotedAttributeValue
	}
}

function singleQuotedAttributeValue(c) {
	if (c === "'") {
		currentToken[currentAttribute.name] = currentAttribute.value
		return afterQuotedAttributeValue
	} else if (c === '\u0000') {
	} else if (c === EOF) {
	} else {
		currentAttribute.value += c
		return singleQuotedAttributeValue
	}
}

function UnquotedAttributeValue(c) {
	if (c.match(/^[\t\n\f ]$/)) {
		currentToken[currentAttribute.name] = currentAttribute.value
		return beforeAttributeName
	} else if (c === '/') {
		currentToken[currentAttribute.name] = currentAttribute.value
		return selfClosingStartTag
	} else if (c === '>') {
		currentToken[currentAttribute.name] = currentAttribute.value
		emit(currentToken)
		return data
	} else if (c === '\u0000') {
	} else if (c === '"' || c === "'" || c === '<' || c === '=') {
	} else if (c === EOF) {
	} else {
		currentAttribute.value += c
		return UnquotedAttributeValue
	}
}

function afterQuotedAttributeValue(c) {
	if (c.match(/^[\t\n\f ]$/)) {
		return beforeAttributeName;
	} else if (c === '/') {
		return selfClosingStartTag
	} else if (c === '>') {
		currentToken[currentAttribute.name] = currentAttribute.value
		emit(currentToken)
		return data
	} else if (c === EOF) {
	} else {
		return beforeAttributeName(c)
	}
}

function selfClosingStartTag(c) {
    if (c === ">") {
        currentToken.isSelfClosing = true;
        emit(currentToken);
        return data;
    }

    // error
    if (c === EOF) {

	}
	
	return beforeAttributeName(c);
}

module.exports.parseHTML = function parseHTML(html) {
    let state = data;
    for (let c of html) {
        state = state(c);
    }
	state = state(EOF);

	return stack.pop();
}