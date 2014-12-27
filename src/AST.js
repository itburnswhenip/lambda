var AbstractNode = exports.AbstractNode = function () {};

AbstractNode.prototype.is = function (Class) {
	return this instanceof Class;
};

AbstractNode.prototype.isAny = function () {
	for (var i = 0; i < arguments.length; i++) {
		if (this instanceof arguments[i]) {
			return true;
		}
	}
	return false;
};


var LiteralNode = exports.LiteralNode = function (value) {
	AbstractNode.call(this);
	this.value = value;
};

LiteralNode.prototype = Object.create(AbstractNode.prototype);

LiteralNode.prototype.getFreeVariables = function () {
	return [];
};

LiteralNode.prototype.evaluate = function () {
	return this.value;
};


var ArrayLiteralNode = exports.ArrayLiteralNode = function (expressions) {
	AbstractNode.call(this);
	this.expressions = expressions;
};

ArrayLiteralNode.prototype = Object.create(AbstractValue.prototype);

ArrayLiteralNode.prototype.getFreeVariables = function () {
	var names = [];
	this.expressions.forEach(function (expression) {
		names = names.union(expression.getFreeVariables());
	});
	return names;
};

ArrayLiteralNode.prototype.evaluate = function (context) {
	return new ArrayValue(this.expressions.map(function (expression) {
		return expression.evaluate(context);
	}));
};


var VariableNode = exports.VariableNode = function (name) {
	AbstractNode.call(this);
	this.name = name;
};

VariableNode.prototype = Object.create(AbstractNode.prototype);

VariableNode.prototype.getFreeVariables = function () {
	return [this.name];
};

VariableNode.prototype.evaluate = function (context) {
	if (context.has(this.name)) {
		return context.top(this.name);
	} else {
		var name = this.name;
		return AbstractValue.unmarshal((function () {
			return this[name];
		}()));
	}
};


var ThisNode = exports.ThisNode = function () {
	AbstractNode.call(this);
};

ThisNode.prototype = Object.create(AbstractNode.prototype);

ThisNode.prototype.getFreeVariables = function () {
	return ['this'];
};

ThisNode.prototype.evaluate = function (context) {
	if (context.has('this')) {
		return context.top('this');
	} else {
		throw new LambdaRuntimeError();
	}
};

ThisNode.INSTANCE = new ThisNode();


var ErrorNode = exports.ErrorNode = function () {
	AbstractNode.call(this);
};

ErrorNode.prototype = Object.create(AbstractNode.prototype);

ErrorNode.prototype.getFreeVariables = function () {
	return ['error'];
};

ErrorNode.prototype.evaluate = function (context) {
	if (context.has('error')) {
		return context.top('error');
	} else {
		throw new LambdaRuntimeError();
	}
};

ErrorNode.INSTANCE = new ErrorNode();


var FieldAccessNode = exports.FieldAccessNode = function (left, name) {
	AbstractNode.call(this);
	this.left = left;
	this.name = name;
};

FieldAccessNode.prototype = Object.create(AbstractNode.prototype);

FieldAccessNode.prototype.getFreeVariables = function () {
	return this.left.getFreeVariables();
};

FieldAccessNode.prototype.evaluate = function (context) {
	var left = this.left.evaluate(context);
	if (left.is(ObjectValue)) {
		if (left.context.has(this.name)) {
			return left.context.top(this.name);
		}
	}
	throw new LambdaRuntimeError();
};


var SubscriptNode = exports.SubscriptNode = function (expression, index) {
	AbstractNode.call(this);
	this.expression = expression;
	this.index = index;
};

SubscriptNode.prototype = Object.create(AbstractNode.prototype);

SubscriptNode.prototype.getFreeVariables = function () {
	return this.expression.getFreeVariables().union(this.index.getFreeVariables());
};

SubscriptNode.prototype.evaluate = function (context) {
	var value = this.expression.evaluate(context);
	if (value.isAny(ArrayValue, StringValue)) {
		var index = this.index.evaluate(context);
		if (index.is(IntegerValue)) {
			if (value.is(ArrayValue)) {
				return value.array[index.value];
			} else if (value.is(StringValue)) {
				return value.value[index.value];
			}
		}
	}
	throw new LambdaRuntimeError();
};


var LambdaNode = exports.LambdaNode = function (name, body) {
	AbstractNode.call(this);
	this.name = name;
	this.body = body;
};

LambdaNode.prototype = Object.create(AbstractNode.prototype);

LambdaNode.prototype.getFreeVariables = function () {
	return this.body.getFreeVariables().filter(function (name) {
		return name !== this.name;
	}, this);
};

LambdaNode.prototype.evaluate = function (context) {
	return new Closure(this, context.capture(this.getFreeVariables()));
};


var ApplicationNode = exports.ApplicationNode = function (left, right) {
	AbstractNode.call(this);
	this.left = left;
	this.right = right;
};

ApplicationNode.prototype = Object.create(AbstractNode.prototype);

ApplicationNode.prototype.getFreeVariables = function () {
	return this.left.getFreeVariables().union(this.right.getFreeVariables());
};

ApplicationNode.prototype.evaluate = function (context) {
	var left = this.left.evaluate(context);
	if (left.is(Closure)) {
		return left.context.augment(left.lambda.name, this.right.evaluate(context), function (context) {
			return left.lambda.body.evaluate(context);
		});
	} else {
		throw new LambdaRuntimeError();
	}
};


var FixNode = exports.FixNode = function () {
	AbstractNode.call(this);
};

FixNode.prototype = Object.create(AbstractNode.prototype);

FixNode.prototype.getFreeVariables = function () {
	return [];
};

FixNode.Z_COMBINATOR = (new LambdaNode('f', new ApplicationNode(
	new LambdaNode('x', new ApplicationNode(
		new VariableNode('f'),
		new LambdaNode('v', new ApplicationNode(
			new ApplicationNode(
				new VariableNode('x'),
				new VariableNode('x')
				),
			new VariableNode('v')
			))
		)),
	new LambdaNode('x', new ApplicationNode(
		new VariableNode('f'),
		new LambdaNode('v', new ApplicationNode(
			new ApplicationNode(
				new VariableNode('x'),
				new VariableNode('x')
				),
			new VariableNode('v')
			))
		))
	))).evaluate(new Context());

FixNode.prototype.evaluate = function () {
	return FixNode.Z_COMBINATOR;
};

FixNode.INSTANCE = new FixNode();


var LetNode = exports.LetNode = function (names, expression, body) {
	AbstractNode.call(this);
	this.names = names;
	this.expression = expression;
	this.body = body;
};

LetNode.prototype = Object.create(AbstractNode.prototype);

LetNode.prototype.getFreeVariables = function () {
	return this.expression.getFreeVariables().union(this.body.getFreeVariables().filter(function (name) {
		return name !== this.names[0];
	}, this));
};

LetNode.prototype.evaluate = function (rootContext) {
	var names = this.names;
	var expression = this.expression;
	var body = this.body;
	return (function evaluate(context, index) {
		if (index < names.length - 1) {
			if (context.has(names[index])) {
				return evaluate(context.top(names[index]).context, index + 1);
			} else {
				var value = new ObjectValue(new Context());
				return context.augment(names[index], value, function () {
					return evaluate(value.context, index + 1);
				});
			}
		} else if (index < names.length) {
			return context.augment(names[index], expression.evaluate(rootContext), function () {
				return body.evaluate(rootContext);
			});
		} else {
			throw new LambdaInternalError();
		}
	}(rootContext, 0));
};


var IfNode = exports.IfNode = function (condition, thenExpression, elseExpression) {
	AbstractNode.call(this);
	this.condition = condition;
	this.thenExpression = thenExpression;
	this.elseExpression = elseExpression;
};

IfNode.prototype = Object.create(AbstractNode.prototype);

IfNode.prototype.getFreeVariables = function () {
	return this.condition.getFreeVariables()
		.union(this.thenExpression.getFreeVariables())
		.union(this.elseExpression.getFreeVariables());
};

IfNode.prototype.evaluate = function (context) {
	var condition = this.condition.evaluate(context);
	if (condition.is(BooleanValue)) {
		if (condition.value) {
			return this.thenExpression.evaluate(context);
		} else {
			return this.elseExpression.evaluate(context);
		}
	} else {
		throw new LambdaRuntimeError();
	}
};


var ThrowNode = exports.ThrowNode = function (expression) {
	AbstractNode.call(this);
	this.expression = expression;
};

ThrowNode.prototype = Object.create(AbstractNode.prototype);

ThrowNode.prototype.getFreeVariables = function () {
	return this.expression.getFreeVariables();
};

ThrowNode.prototype.evaluate = function (context) {
	throw new LambdaUserError(this.expression.evaluate(context));
};


var TryCatchNode = exports.TryCatchNode = function (tryExpression, catchExpression) {
	AbstractNode.call(this);
	this.tryExpression = tryExpression;
	this.catchExpression = catchExpression;
};

TryCatchNode.prototype = Object.create(AbstractNode.prototype);

TryCatchNode.prototype.getFreeVariables = function () {
	return this.tryExpression.getFreeVariables()
		.union(this.catchExpression.getFreeVariables().filter(function (name) {
			return name !== 'error';
	}));
};

TryCatchNode.prototype.evaluate = function (context) {
	try {
		return this.tryExpression.evaluate(context);
	} catch (e) {
		if (e instanceof LambdaUserError) {
			return context.augment('error', e.value, function (context) {
				return this.catchExpression.evaluate(context);
			}, this);
		} else {
			throw e;
		}
	}
};


var TryFinallyNode = exports.TryFinallyNode = function (tryExpression, finallyExpression) {
	AbstractNode.call(this);
	this.tryExpression = tryExpression;
	this.finallyExpression = finallyExpression;
};

TryFinallyNode.prototype = Object.create(AbstractNode.prototype);

TryFinallyNode.prototype.getFreeVariables = function () {
	return this.tryExpression.getFreeVariables()
		.union(this.finallyExpression.getFreeVariables());
};

TryFinallyNode.prototype.evaluate = function (context) {
	try {
		return this.tryExpression.evaluate(context);
	} finally {
		this.finallyExpression.evaluate(context);
	}
};


var TryCatchFinallyNode = exports.TryCatchFinallyNode = function (tryExpression, catchExpression, finallyExpression) {
	AbstractNode.call(this);
	this.tryExpression = tryExpression;
	this.catchExpression = catchExpression;
	this.finallyExpression = finallyExpression;
};

TryCatchFinallyNode.prototype = Object.create(AbstractNode.prototype);

TryCatchFinallyNode.prototype.getFreeVariables = function () {
	return this.tryExpression.getFreeVariables()
		.union(this.catchExpression.getFreeVariables().filter(function (name) {
			return name !== 'error';
	}))
		.union(this.finallyExpression.getFreeVariables());
};

TryCatchFinallyNode.prototype.evaluate = function (context) {
	try {
		return this.tryExpression.evaluate(context);
	} catch (e) {
		if (e instanceof LambdaUserError) {
			return context.augment('error', e.value, function (context) {
				return this.catchExpression.evaluate(context);
			}, this);
		} else {
			throw e;
		}
	} finally {
		this.finallyExpression.evaluate(context);
	}
};


var UnaryOperatorNode = exports.UnaryOperatorNode = function (evaluator) {
	AbstractNode.call(this);
	this.evaluator = evaluator;
};

UnaryOperatorNode.prototype = Object.create(AbstractNode.prototype);

UnaryOperatorNode.prototype.getFreeVariables = function () {
	return ['x'];
};

UnaryOperatorNode.prototype.evaluate = function (context) {
	if (context.has('x')) {
		return AbstractValue.unmarshal(this.evaluator(context.top('x').marshal()));
	} else {
		throw new LambdaRuntimeError();
	}
};


var BinaryOperatorNode = exports.BinaryOperatorNode = function (evaluator) {
	AbstractNode.call(this);
	this.evaluator = evaluator;
};

BinaryOperatorNode.prototype = Object.create(AbstractNode.prototype);

BinaryOperatorNode.prototype.getFreeVariables = function () {
	return ['x', 'y'];
};

BinaryOperatorNode.prototype.evaluate = function (context) {
	if (context.has('x') && context.has('y')) {
		return AbstractValue.unmarshal(this.evaluator(
			context.top('x').marshal(),
			context.top('y').marshal()
			));
	} else {
		throw new LambdaRuntimeError();
	}
};


var NativeNode = exports.NativeNode = function (nativeFunction, thisArgument, argumentNames) {
	AbstractNode.call(this);
	this.nativeFunction = nativeFunction;
	this.thisArgument = thisArgument;
	this.argumentNames = argumentNames;
};

NativeNode.prototype = Object.create(AbstractNode.prototype);

NativeNode.prototype.getFreeVariables = function () {
	return this.argumentNames;
};

NativeNode.prototype.evaluate = function (context) {
	return AbstractValue.unmarshal(this.nativeFunction.apply(this.thisArgument, this.argumentNames.map(function (name) {
		if (context.has(name)) {
			return context.top(name).marshal();
		} else {
			throw new LambdaRuntimeError();
		}
	})));
};
