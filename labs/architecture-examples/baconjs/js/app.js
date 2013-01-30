$(function() {
  var KEYCODE_ENTER = 13
  todoTemplate = Handlebars.compile($("#todo-template").html())
  $newTodo = $("#new-todo")
  $todoList = $("#todo-list")
  function enterKey(element) {
    return element.asEventStream("keyup").filter(function(e) { return e.keyCode == KEYCODE_ENTER })
  }
  function update(todos, updatedTodo) {
    return _.map(todos, function(todo) { return todo.id === updatedTodo.id ? updatedTodo : todo })
  }
  function renderTodo(newTodo) {
    $newTodo.val("")
    var todoElement = $(todoTemplate(newTodo))
    var $label = todoElement.find("label")
    var $editor = todoElement.find(".edit")
    var title = Bacon.UI.textFieldValue($editor, newTodo.title)
    var completed = Bacon.UI.checkBoxValue(todoElement.find(".toggle"), newTodo.completed)

    $todoList.append(todoElement)
    todoElement.asEventStream("dblclick").merge(enterKey($editor)).onValue(function() { todoElement.toggleClass("editing") })
    title.assign($label, "text")

    var todoProperty = Bacon.combineTemplate({
      id: newTodo.id,
      title: title,
      completed: completed
    })
    todoModified.plug(todoProperty.changes())
  }
  newTodoId = enterKey($newTodo).scan(0, function(id,_) { return id + 1 })
  todoAdded = Bacon.combineTemplate({ 
    id: newTodoId,
    title: Bacon.UI.textFieldValue($newTodo),
    completed: false
  }).sampledBy(newTodoId.changes())
  todoModified = new Bacon.Bus()
  clearCompleted = $("#clear-completed").asEventStream("click")

  todoChanges = todoAdded
                  .map(function(newTodo) { return function(todos) { return todos.concat([newTodo]) }})
                  .merge(clearCompleted.map(function() { return function(todos) { return _.where(todos, {completed : false})}}))
                  .merge(todoModified.map(function(todo) { return function(todos) { return update(todos, todo) }}))

  allTodos = todoChanges.scan([], function(todos, f) { return f(todos) })

  activeTodos = allTodos.map(function(todos) { return _.where(todos, { completed: false})})
  completedTodos = allTodos.map(function(todos) { return _.where(todos, { completed: true})})

  repaint = clearCompleted

  repaint.map(allTodos).onValue(function(todos) {
    $todoList.children().remove()
    _.each(todos, renderTodo)
  })
  todoAdded.onValue(renderTodo)
  activeTodos.map(".length").assign($("#todo-count strong"), "text")
  completedTodos.map(function(todos) { return todos.length > 0 }).assign($("#clear-completed"), "toggle")
})
