var ELC_debug_mode = false;
var ELC_initialized = false;

HTMLElement.prototype.getFirstElementWithData = function(data, value)
{
	for(var i = 0; i < this.children.length; i++)
		if(this.children[i].dataset[data] != null && this.children[i].dataset[data] == value)
			return this.children[i];
	for(var i = 0; i < this.children.length; i++)
	{
		var result = this.children[i].getFirstElementWithData(data, value);
		if(result != null)
			return result;
	}
	return null;
}

HTMLTableSectionElement.prototype.updatePracticalCellIndices = function()
{
	var matrix = [];
	for(var i = 0; i < this.rows.length; i++)
		matrix[i] = [];
	for(var i = 0; i < this.rows.length; i++)
	{
		var row = this.rows.item(i);
		for(var k = 0; k < row.cells.length; k++)
		{
			var cell = row.cells.item(k);
			cell.practicalCellIndex = cell.cellIndex;
			while(matrix[i][cell.practicalCellIndex])
				cell.practicalCellIndex++;
			for(var r = 0; r < cell.rowSpan; r++)
				for(var c = 0; c < cell.colSpan; c++)
					matrix[i+r][cell.practicalCellIndex+c] = 1;
		}
	}
}

HTMLSelectElement.prototype.getSelectedOptions = function()
{
	if(this.selectedOptions != null)
		return this.selectedOptions;
	var result = [];
	for(var i = 0; i < this.options.length; i++)
		if(this.options[i].tagName == "OPTION" && this.options[i].selected && this.options[i].value.length > 0)
			result.push(this.options[i]);
	return result;
}

function ELC_logFunctionExecution(begin, closed, extra)
{
	if(ELC_debug_mode && ELC_logFunctionExecution.caller != null)
	{
		if(begin)
		{
			console.time(ELC_logFunctionExecution.caller.name + (extra!=null ? " ("+extra+")" : "") +" execution time");
			if(closed)
				console.groupCollapsed(ELC_logFunctionExecution.caller.name +"("+ Array.prototype.join.call(ELC_logFunctionExecution.caller.arguments,",") +") logging"+ (extra!=null ? ": "+extra : ""));
			else
				console.group(ELC_logFunctionExecution.caller.name +"("+ Array.prototype.join.call(ELC_logFunctionExecution.caller.arguments,",") +") logging"+ (extra!=null ? ": "+extra : ""));
		}
		else
		{
			console.timeEnd(ELC_logFunctionExecution.caller.name + (extra!=null ? " ("+extra+")" : "") +" execution time");
			console.groupEnd();
		}
	}
}

function ELC_getFieldValue(record, field, type)
{
	var string = "";
	if(record.parentNode.ELC_activeTemplate != null)
	{
		// TODO: Maybe let them choose if they want to pull from template data rather than assuming?
		// TODO: Doesn't work with most tables, because field name gets converted to cell index. However, table cell reading should still be pretty fast since it should never need to call getFirstElementWithData.
		var data = ELC_listDataModels[record.parentNode.ELC_activeTemplate].data[record.id.substring(record.parentNode.ELC_activeTemplate.length+1)];
		if(data != null && data[field] != null)
		{
			if(ELC_debug_mode) console.log("Using '"+ record.parentNode.ELC_activeTemplate +"' template value.");
			string = data[field];
		}
	}
	if(string != "") {/*we good*/}
	else if(record.dataset[field+"Value"] != null)
		string = record.dataset[field+"Value"];
	else
	{
		var element;
		if(record.tagName == "TR" && !isNaN(field))
			element = record.children[field];
		if(element == null)
			element = record.getFirstElementWithData("field", field);
		if(element != null)
			string = (element.dataset.value!=null ? element.dataset.value : (type=="html" ? element.innerHTML : element.innerText));
	}
	if(type == "number")
		return parseFloat(string);
	else if(type == "date")
		return Date.parse(string);
	else
		return string;
}

var ELC_listDataModels = {"-pre-init-":[]};
function ELC_setData(template_id, data, auto, ajax)
{
	if(ELC_initialized) // TODO: We don't need ELC to be initialized, just the DOM so that document.getElementById(template_id) can access it.
	{
		var template = document.getElementById(template_id);
		if(template != null)
		{
			if(typeof data == "object")
			{
				for(var i in ELC_listDataModels)
					if(ELC_listDataModels[i].nextSibling == template)
						ELC_listDataModels[i].nextSibling = template.nextSibling;
				ELC_listDataModels[template_id] = {parent:template.parentNode,template:template,data:data,nextSibling:template.nextSibling,ajax:ajax};
				template.parentNode.removeChild(template);
				if(auto)
					ELC_activateTemplate(template_id);
			}
			else
			{
				template.parentNode.removeChild(template);
				console.error("Invalid data model specified in ELC_setData: "+ String(data) +"; must be an array.");
			}
		}
		else if(ELC_listDataModels[template_id] != null)
		{
			if(typeof data == "object")
			{
				if(ELC_listDataModels[template_id].parent.ELC_activeTemplate == template_id)
				{
					ELC_deactivateTemplate(template_id);
					auto = true;
				}
				ELC_listDataModels[template_id].data = data;
				if(auto)
					ELC_activateTemplate(template_id);
			}
			else
				console.error("Invalid data model specified in ELC_setData: "+ String(data) +"; must be an array. Note: The template has also already been loaded previously.");
		}
		else
			console.error("Invalid template id specified in ELC_setData: "+ template_id);
	}
	else
	{
		ELC_listDataModels["-pre-init-"].push({template_id:template_id,data:data,auto:auto,ajax:ajax});
	}
}

function ELC_activateTemplate(template_id)
{
	if(ELC_listDataModels[template_id] != null)
	{
		if(ELC_listDataModels[template_id].parent.ELC_activeTemplate == null)
		{
			ELC_logFunctionExecution(true);
			ELC_executeHook("before_template_activate", ELC_listDataModels[template_id]);
			ELC_listDataModels[template_id].parent.ELC_activeTemplate = template_id
			var temp = document.createElement("template");
			if(temp.content != null)
			{
				for(var i in ELC_listDataModels[template_id].data)
				{
					if(ELC_listDataModels[template_id].data[i] == null)
						continue;
					temp.innerHTML = ELC_listDataModels[template_id].template.outerHTML.replace(/\{\{(\w+)}}/g, function(m,v){return ELC_listDataModels[template_id].data[i][v];}).trim();
					temp.content.firstChild.id = template_id +"_"+ i;
					ELC_listDataModels[template_id].parent.insertBefore(temp.content.firstChild, ELC_listDataModels[template_id].nextSibling);
				}
			}
			else
			{
				var possibles = ["div", "tbody"];
				var p = 0;
				do {
					temp = document.createElement(possibles[p]);
					temp.innerHTML = ELC_listDataModels[template_id].template.outerHTML.trim();
					p++;
				} while(temp.firstChild.tagName == null && p < possibles.length);
				if(temp.firstChild.tagName == null)
					console.error("Unable to dynamically create elements of type: "+ ELC_listDataModels[template_id].template.tagName);
				else
				{
					for(var i in ELC_listDataModels[template_id].data)
					{
						if(ELC_listDataModels[template_id].data[i] == null)
							continue;
						temp.innerHTML = ELC_listDataModels[template_id].template.outerHTML.replace(/\{\{(\w+)}}/g, function(m,v){return ELC_listDataModels[template_id].data[i][v];}).trim();
						temp.firstChild.id = template_id +"_"+ i;
						ELC_listDataModels[template_id].parent.insertBefore(temp.firstChild, ELC_listDataModels[template_id].nextSibling);
					}
				}
			}
			ELC_executeHook("after_template_activate", ELC_listDataModels[template_id]);
			ELC_logFunctionExecution(false);
		}
		else if(ELC_listDataModels[template_id].parent.ELC_activeTemplate == template_id)
			console.warn("Template '"+ template_id +"' is already active.");
		else
			console.error("Tried to activate template '"+ template_id +"' when template '"+ ELC_listDataModels[template_id].parent.ELC_activeTemplate +"' is already active. Only one template can be active on a given element at a time.");
	}
	else
		console.error("Invalid template id specified in ELC_activateTemplate: "+ template_id);
}

function ELC_deactivateTemplate(template_id)
{
	if(ELC_listDataModels[template_id] != null)
	{
		if(ELC_listDataModels[template_id].parent.ELC_activeTemplate == template_id)
		{
			ELC_logFunctionExecution(true);
			ELC_executeHook("before_template_deactivate", ELC_listDataModels[template_id]);
			for(var i in ELC_listDataModels[template_id].data)
			{
				if(ELC_listDataModels[template_id].data[i] == null)
					continue;
				var id = template_id +"_"+ i;
				ELC_listDataModels[template_id].parent.removeChild(document.getElementById(id));
			}
			ELC_listDataModels[template_id].parent.ELC_activeTemplate = null;
			ELC_executeHook("after_template_deactivate", ELC_listDataModels[template_id]);
			ELC_logFunctionExecution(false);
		}
		else
			console.warn("Template '"+ template_id +"' is not active.");
	}
	else
		console.error("Invalid template id specified in ELC_deactivateTemplate: "+ template_id);
}

var ELC_hooks = { // TODO: make this an object property, maybe?
	// this = the DOM element being updated
	before_update:[],
	after_update:[],
	// this = child of ELC_listDataModels containing the template info
	before_template_activate:[],
	after_template_activate:[],
	before_template_deactivate:[],
	after_template_deactivate:[],
	// this = the filter that was changed
	filters_changed_by_controller:[],
};
function ELC_addHook(type, callback, params)
{
	if(ELC_hooks[type] != null)
		ELC_hooks[type].push({callback:callback,params:params});
	else
		console.error("Invalid ELC hook: "+ type);
}

function ELC_executeHook(type, context)
{
	if(ELC_hooks[type] != null)
	{
		for(var i in ELC_hooks[type])
		{
			try
			{
				ELC_hooks[type][i].callback.apply(context, ELC_hooks[type][i].params);
			}
			catch(err)
			{
				console.warn("Error while running '"+ type +"' hook #"+i+" ("+ ELC_hooks[type][i].callback.name +"): ", err);
			}
		}
	}
	else
		console.error("Invalid ELC hook: "+ type);
}

function ELC_update(list_container, type)
{
	/*if(ajax != null)
	{
		return ELC_update_request(list_container);
	}*/
	if(ELC_debug_mode)
	{
		if(type=="mutation")
			console.log("ELC_update() called on '"+ list_container.id +"' as the result of a mutation.");
		ELC_logFunctionExecution(true);
	}
	var list_collection = (list_container.tagName=="TABLE" ? list_container.tBodies : [list_container]); // I don't like creating a random array here but it's cleaner than anything else I thought of.
	for(var k = 0; k < list_collection.length; k++)
		if(list_collection[k].ELC_MutationObserver != null)
			list_collection[k].ELC_MutationObserver.disconnect();
	ELC_executeHook("before_update", list_container);
	if(type != "page" && type != "filter")
		ELC_sort_list(list_container);
	if(type != "page" && type != "sort")
		ELC_apply_filter(list_container);
	ELC_display_page(list_container);
	ELC_addAlternatingClasses(list_container);
	ELC_executeHook("after_update", list_container);
	for(var k = 0; k < list_collection.length; k++)
		if(list_collection[k].ELC_MutationObserver != null)
			list_collection[k].ELC_MutationObserver.observe(list_collection[k], {childList:true});
	ELC_logFunctionExecution(false);
}

function ELC_update_request(list_container, URL)
{
	var httpRequest = new XMLHttpRequest();
	httpRequest.onreadystatechange = ELC_update_response;
	httpRequest.open("POST", URL, true);
	httpRequest.setRequestHeader("Content-Type", "application/json");
	httpRequest.send({
		x: list_container.ELC_current_sort_field,
		x: list_container.ELC_current_sort_reversed,
		x: list_container.ELC_current_sort_type,
	});
}

function ELC_update_response(a,b,c)
{
	console.log(this, a, b, c);
}

function ELC_addAlternatingClasses(list_container)
{
	var all_elements = list_container.tagName=="TABLE" ? list_container.rows : list_container.children;
	var alt = false;
	for(var i = 0; i < all_elements.length; i++)
	{
		if(all_elements[i].parentNode.tagName == "THEAD" || all_elements[i].parentNode.tagName == "TFOOT")
			continue;
		all_elements[i].classList.remove("elceven");
		all_elements[i].classList.remove("elcodd");
		if(!all_elements[i].classList.contains("paged-out") && (!all_elements[i].classList.contains("filtered-out") || list_container.dataset.pagesIncludeFiltered != null))
		{
			all_elements[i].classList.add(alt ? "elceven" : "elcodd");
			alt = !alt;
		}
	}
}

function ELC_observerCallback(mutationList, mutationObserver)
{
	var updated = [];
	for(var i in mutationList)
	{
		if(ELC_debug_mode) console.log("MutationObserver observed a mutation: ", mutationList[i]);
		if(updated.indexOf(mutationList[i].target) == -1 && mutationList[i].type == "childList")
		{
			updated.push(mutationList[i].target);
			if(mutationList[i].target.tagName == "TBODY")
				ELC_update(mutationList[i].target.parentNode, "mutation");
			else
				ELC_update(mutationList[i].target, "mutation");
		}
	}
}

function ELC_getListContainer(current, containerClass, myClasses)
{
	do {
		if(current.classList.contains(containerClass))
			return current;
		else if(current.dataset.container != null)
		{
			for(var i in myClasses)
			{
				if(current.classList.contains(myClasses[i]))
					var result = document.getElementById(current.dataset.container);
				if(result != null && result.classList.contains(containerClass))
					return result;
			}
		}
		current = current.parentElement;
	} while(current != null);
	return null;
}

// ---- Begin sorting functions ----
function ELC_sort_event_listener(event)
{
	if(event != null && event.detail != null && event.detail.no_ELC)
		return;
	if(this.ELC_list_container == null)
	{
		console.error("Cannot find the table this sorter is meant to apply to: "+ $(this));
		return;
	}
	ELC_logFunctionExecution(true);
	this.ELC_list_container.ELC_current_sort_type = this.ELC_sort_type;
	if(this.ELC_list_container.ELC_current_sort_field == this.ELC_field)
	{
		this.ELC_list_container.ELC_current_sort_reversed = !this.ELC_list_container.ELC_current_sort_reversed;
	}
	else
	{
		this.ELC_list_container.ELC_current_sort_field = this.ELC_field;
		this.ELC_list_container.ELC_current_sort_reversed = (this.dataset.order != null && this.dataset.order.toLowerCase()[0] == "d");
	}
	for(var i in this.ELC_list_container.ELC_list_sorters)
	{
		this.ELC_list_container.ELC_list_sorters[i].classList.remove("sortup");
		this.ELC_list_container.ELC_list_sorters[i].classList.remove("sortdown");
		if(this.ELC_list_container.ELC_list_sorters[i].ELC_field == this.ELC_list_container.ELC_current_sort_field)
		{
			if(this.ELC_list_container.ELC_current_sort_reversed)
				this.ELC_list_container.ELC_list_sorters[i].classList.add("sortup");
			else
				this.ELC_list_container.ELC_list_sorters[i].classList.add("sortdown");
		}
	}
	if(event == null || event.detail == null || !event.detail.ELC_noUpdate)
		ELC_update(this.ELC_list_container, "sort");
	ELC_logFunctionExecution(false);
}

function ELC_sort_list(list_container)
{
	if(list_container.ELC_current_sort_field == null)
		return;
	ELC_logFunctionExecution(true);
	var list_collection = (list_container.tagName=="TABLE" ? list_container.tBodies : [list_container]); // I don't like creating a random array here but it's cleaner than anything else I thought of.
	for(var k = 0; k < list_collection.length; k++)
	{
		var list = list_collection[k];
		for(var i = 0; i < list.children.length; i++)
		{
			// TODO: MAYBE... For header cells with colspan, concatenate the data in those columns when sorting. So if the first col has a tie, sort by the second, etc.
			list.children[i].ELC_current_sort_value = ELC_getFieldValue(list.children[i], list_container.ELC_current_sort_field, list_container.ELC_current_sort_type);
			if(list_container.dataset.sortTransitionTime != null)
			{
				list.children[i].ELC_prevTop = list.children[i].offsetTop;
				list.children[i].ELC_prevLeft = list.children[i].offsetLeft;
			}
		}
		ELC_logFunctionExecution(true, false, "actual merge sort");
		ELC_merge_sort(list.children, list_container, list);
		ELC_logFunctionExecution(false, false, "actual merge sort");
	}
	// TODO: Don't animate if this was triggered by a sort-initial
	if(list_container.dataset.sortTransitionTime != null)
	{
		if(ELC_debug_mode) console.time("Animation execution time");
		var all_elements = (list_container.tagName=="TABLE" ? list_container.rows : list_container.children);
		for(var i = 0; i < all_elements.length; i++)
		{
			var element = all_elements[i];
			if(element.parentNode.tagName == "THEAD" || element.parentNode.tagName == "TFOOT")
				continue;
			if(window.getComputedStyle(element, null).getPropertyValue("position") == "static")
				element.style.position = "relative";
			if(element.tagName == "TR")
			{
				// Why do TRs have to be so annoying.
				for(var k = 0; k < element.children.length; k++)
				{
					var subelement = element.children[k];
					if(window.getComputedStyle(subelement, null).getPropertyValue("position") == "static")
						subelement.style.position = "relative";
					subelement.style.transition = "all 0s";
					subelement.style.top = (element.ELC_prevTop - element.offsetTop) +"px";
					subelement.style.left = (element.ELC_prevLeft - element.offsetLeft) +"px";
					setTimeout(function(element, subelement){
						subelement.style.transition = "all "+ list_container.dataset.sortTransitionTime;
						setTimeout(function(element, subelement){
							// Not compatible with any top/left that may already be set.
							subelement.style.top = "0px";
							subelement.style.left = "0px";
						}, 1, element, subelement);
					}, 1, element, subelement);
				}
			}
			else
			{
				element.style.transition = "all 0s";
				element.style.top = (element.ELC_prevTop - element.offsetTop) +"px";
				element.style.left = (element.ELC_prevLeft - element.offsetLeft) +"px";
				setTimeout(function(element){
					element.style.transition = "all "+ list_container.dataset.sortTransitionTime;
					setTimeout(function(element){
						// Not compatible with any top/left that may already be set.
						element.style.top = "0px";
						element.style.left = "0px";
					}, 1, element);
				}, 1, element);
			}
		}
		if(ELC_debug_mode) console.timeEnd("Animation execution time");
	}
	ELC_logFunctionExecution(false);
}

function ELC_merge_sort(list, container, target)
{
	var one = Array.prototype.slice.call(list, 0, Math.floor(list.length/2));
	var two = Array.prototype.slice.call(list, Math.floor(list.length/2));
	if(one.length > 1)
		ELC_merge_sort(one, container);
	if(two.length > 1)
		ELC_merge_sort(two, container);
	for(var i = 0; i < list.length; i++)
	{
		if(!one.length || two.length && ELC_compare(two[0], one[0], container) > 0)
		{
			if(target != null && target.children.length == list.length)
				target.appendChild(two.shift());
			else
				list[i] = two.shift();
		}
		else
		{
			if(target != null && target.children.length == list.length)
				target.appendChild(one.shift());
			else
				list[i] = one.shift();
		}
	}
}

function ELC_compare(a, b, container)
{
	if(container.ELC_current_sort_type == "number")
		return (container.ELC_current_sort_reversed?-1:1) * (b.ELC_current_sort_value - a.ELC_current_sort_value);
	else
		return (container.ELC_current_sort_reversed?-1:1) * b.ELC_current_sort_value.toString().localeCompare(a.ELC_current_sort_value.toString());
}
// ---- End sorting functions ----

// ---- Begin filtering functions ----
function ELC_apply_filter(list_container)
{
	if(list_container.ELC_active_filters == null)
		return;
	ELC_logFunctionExecution(true);
	var list_elements = (list_container.tagName=="TABLE" ? list_container.rows : list_container.children);
	for(var i = 0; i < list_elements.length; i++)
	{
		if(list_elements[i].parentNode.tagName == "THEAD" || list_elements[i].parentNode.tagName == "TFOOT")
			continue;
		ELC_logFunctionExecution(true, true, "element#"+i);
		list_elements[i].classList.remove("filtered-out");
		for(var filter_field in list_container.ELC_active_filters)
		{
			// TODO: Oh boy, this whole values object thing is real bad. Need to find a much more efficient way to get these values by type.
			if(filter_field)
			{
				var field = (list_container.ELC_filter_columns!=null&&list_container.ELC_filter_columns[filter_field]!=null ? list_container.ELC_filter_columns[filter_field] : filter_field);
				var values = {
					'text': ELC_getFieldValue(list_elements[i], field, "text").toString().toLowerCase(),
					'number': ELC_getFieldValue(list_elements[i], field, "number"),
					'html': ELC_getFieldValue(list_elements[i], field, "html").toString().toLowerCase(),
					'date': ELC_getFieldValue(list_elements[i], field, "date"),
				};
			}
			else
			{
				var values = { // TODO: This ignores data-value and will only check the visible text. Is that ok?
					'text': list_elements[i].innerText.toString().toLowerCase(),
					'number': list_elements[i].innerText.toString().toLowerCase(),
					'html': list_elements[i].innerHTML.toString().toLowerCase(),
					'date': list_elements[i].innerText.toString().toLowerCase(),
				};
			}
			// TODO: MAYBE... For header cells with colspan, concatenate the data in those columns when filtering. So if that header is the filter field, search all of its columns.
			
			var thisfilter = list_container.ELC_active_filters[filter_field];
			var and_clause = true;
			if(thisfilter.and != null && Object.keys(thisfilter.and).length > 0)
			{
				for(var t in thisfilter.and)
				{
					if(thisfilter.and[t].type == "date" && thisfilter.and[t].value != values.date)
					{
						and_clause = false;
						break;
					}
					else if(thisfilter.and[t].type == "number")
					{
						if(thisfilter.and[t].comparison == ">=")
						{
							if(values.number < thisfilter.and[t].value)
							{
								and_clause = false;
								break;
							}
						}
						else if(thisfilter.and[t].comparison == "<=")
						{
							if(values.number > thisfilter.and[t].value)
							{
								and_clause = false;
								break;
							}
						}
						else if(thisfilter.and[t].comparison == ">")
						{
							if(values.number <= thisfilter.and[t].value)
							{
								and_clause = false;
								break;
							}
						}
						else if(thisfilter.and[t].comparison == "<")
						{
							if(values.number >= thisfilter.and[t].value)
							{
								and_clause = false;
								break;
							}
						}
						// Default is =
						else if(values.number != thisfilter.and[t].value)
						{
							and_clause = false;
							break;
						}
					}
					else if(thisfilter.and[t].type == "html")
					{
						if(thisfilter.and[t].comparison == "=")
						{
							if(values.html != thisfilter.and[t].value.toLowerCase())
							{
								and_clause = false;
								break;
							}
						}
						// Default is *=
						else if(values.html.indexOf(thisfilter.and[t].value.toLowerCase()) == -1)
						{
							and_clause = false;
							break;
						}
					}
					else if(thisfilter.and[t].type == "text" || thisfilter.and[t].type == "")
					{
						if(thisfilter.and[t].comparison == "=")
						{
							if(values.text != thisfilter.and[t].value.toLowerCase())
							{
								and_clause = false;
								break;
							}
						}
						// Default is *=
						else if(values.text.indexOf(thisfilter.and[t].value.toLowerCase()) == -1)
						{
							and_clause = false;
							break;
						}
					}
				}
			}
			if(!and_clause)
			{
				list_elements[i].classList.add("filtered-out");
				break;
			}
			
			var or_clause = true;
			if(thisfilter.or != null && Object.keys(thisfilter.or).length > 0)
			{
				or_clause = false;
				for(var t in thisfilter.or)
				{
					if(thisfilter.or[t].type == "date" && thisfilter.or[t].value == values.date)
					{
						or_clause = true;
						break;
					}
					else if(thisfilter.or[t].type == "number" && thisfilter.or[t].value == values.number)
					{
						or_clause = true;
						break;
					}
					else if(thisfilter.or[t].type == "html")
					{
						if(thisfilter.or[t].comparison == "=")
						{
							if(values.html == thisfilter.or[t].value.toLowerCase())
							{
								or_clause = true;
								break;
							}
						}
						// Default is *=
						else if(values.html.indexOf(thisfilter.or[t].value.toLowerCase()) != -1)
						{
							or_clause = true;
							break;
						}
					}
					else if(thisfilter.or[t].type == "text" || thisfilter.or[t].type == "")
					{
						if(thisfilter.or[t].comparison == "=")
						{
							if(values.text == thisfilter.or[t].value.toLowerCase())
							{
								or_clause = true;
								break;
							}
						}
						else if(thisfilter.or[t].comparison == "~=")
						{
							//thisfilter.or[t].value.toLowerCase()
							if(values.text.match(new RegExp("\\b"+ thisfilter.or[t].value.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +"\\b")))
							{
								or_clause = true;
								break;
							}
						}
						// Default is *=
						else if(values.text.indexOf(thisfilter.or[t].value.toLowerCase()) != -1)
						{
							or_clause = true;
							break;
						}
					}
				}
			}
			if(!or_clause)
			{
				list_elements[i].classList.add("filtered-out");
				break;
			}
			
			var not_clause = true;
			if(thisfilter.not != null && Object.keys(thisfilter.not).length > 0)
			{
				for(var t in thisfilter.not)
				{
					if(thisfilter.not[t].type == "date" && thisfilter.not[t].value == values.date)
					{
						not_clause = false;
						break;
					}
					else if(thisfilter.not[t].type == "number" && thisfilter.not[t].value == values.number)
					{
						not_clause = false;
						break;
					}
					else if(thisfilter.not[t].type == "html")
					{
						if(thisfilter.not[t].comparison == "=")
						{
							if(values.html == thisfilter.not[t].value.toLowerCase())
							{
								not_clause = false;
								break;
							}
						}
						// Default is *=
						else if(values.html.indexOf(thisfilter.not[t].value.toLowerCase()) != -1)
						{
							not_clause = false;
							break;
						}
					}
					else if(thisfilter.not[t].type == "text" || thisfilter.not[t].type == "")
					{
						if(thisfilter.not[t].comparison == "=")
						{
							if(values.text == thisfilter.not[t].value.toLowerCase())
							{
								not_clause = false;
								break;
							}
						}
						// Default is *=
						else if(values.text.indexOf(thisfilter.not[t].value.toLowerCase()) != -1)
						{
							not_clause = false;
							break;
						}
					}
				}
			}
			if(!not_clause)
			{
				list_elements[i].classList.add("filtered-out");
				break;
			}
			
			//if(ELC_debug_mode) console.log({element:list_elements[i], field:filter_field, textToSearch:text, allFilters:list_container.ELC_active_filters, andResult:and_clause, orResult:or_clause, notResult:not_clause});
		}
		ELC_logFunctionExecution(false, true, "element#"+i);
	}
	ELC_logFunctionExecution(false);
}

function ELC_filter_controller_listener(e)
{
	ELC_logFunctionExecution(true);
	var containers = {};
	for(var i in this.ELC_filters)
	{
		if(this.ELC_filters[i].ELC_clearers != null && this.ELC_filters[i].ELC_clearers.indexOf(this) != -1)
		{
			if(this.ELC_filters[i].type == "checkbox" || this.ELC_filters[i].type == "radio")
				this.ELC_filters[i].checked = (this.ELC_filters[i].value == "");
			else
				this.ELC_filters[i].value = "";
			this.ELC_filters[i].dispatchEvent(new CustomEvent("change", {detail:{no_ELC:1}})); // TODO: Should we check if the element was actually changed by this?
			ELC_executeHook("filters_changed_by_controller", this.ELC_filters[i]);
		}
		if(this.ELC_filters[i].ELC_resetters != null && this.ELC_filters[i].ELC_resetters.indexOf(this) != -1)
		{
			if(this.ELC_filters[i].type == "select-multiple")
				for(var k = 0; k < this.ELC_filters[i].options.length; k++)
					this.ELC_filters[i].options[k].selected = this.ELC_filters[i].options[k].ELC_resetValue;
			else if(this.ELC_filters[i].type == "checkbox" || this.ELC_filters[i].type == "radio")
				this.ELC_filters[i].checked = this.ELC_filters[i].ELC_resetValue;
			else
				this.ELC_filters[i].value = this.ELC_filters[i].ELC_resetValue;
			this.ELC_filters[i].dispatchEvent(new CustomEvent("change", {detail:{no_ELC:1}})); // TODO: Should we check if the element was actually changed by this?
			ELC_executeHook("filters_changed_by_controller", this.ELC_filters[i]);
		}
		if(this.ELC_filters[i].ELC_appliers == null || this.ELC_filters[i].ELC_appliers.indexOf(this) != -1)
		{
			if(containers[this.ELC_filters[i].ELC_list_container.id] == null)
				containers[this.ELC_filters[i].ELC_list_container.id] = {ELC_list_container:this.ELC_filters[i].ELC_list_container, ELC_filters:[]};
			containers[this.ELC_filters[i].ELC_list_container.id].ELC_filters.push(this.ELC_filters[i]);
		}
	}
	console.log(containers);
	//ELC_executeHook("filters_changed_by_controller", this);
	for(var i in containers)
	{
		ELC_filter_change_listener.call(containers[i], e);
	}
	ELC_logFunctionExecution(false);
}

function ELC_filter_change_listener(e)
{
	if(e != null && e.detail != null && e.detail.no_ELC)
		return;
	if(this.ELC_list_container == null)
	{
		console.error("Cannot find the table this filter is meant to apply to: "+ $(this));
		return;
	}
	clearTimeout(this.ELC_list_container.ELC_filter_delay);
	if(e != null && e.type == "keyup") // Give user some "time" to finish typing.
		this.ELC_list_container.ELC_filter_delay = setTimeout(function(c,e){ELC_filter_change_listener_step2.call(c,e);}, 250, this, e);
	else
		ELC_filter_change_listener_step2.call(this, e);
}

function ELC_filter_change_listener_step2(e)
{
	ELC_logFunctionExecution(true);
	// TODO: save the current filters instead of rebuild from scratch if they haven't changed
	this.ELC_list_container.ELC_active_filters = {};
	for(var i = 0; i < this.ELC_list_container.ELC_list_filters.length; i++)
	{
		var current_filter = this.ELC_list_container.ELC_list_filters[i];
		if(current_filter.value.length == 0)
			continue;
		var field = current_filter.ELC_field;
		if(this.ELC_list_container.ELC_active_filters[field] == null)
			this.ELC_list_container.ELC_active_filters[field] = {};
		switch(current_filter.type)
		{
			case "checkbox":
				if(current_filter.checked)
				{
					if(this.ELC_list_container.ELC_active_filters[field].or == null)
						this.ELC_list_container.ELC_active_filters[field].or = {};
					this.ELC_list_container.ELC_active_filters[field].or[i] = {source:current_filter,value:current_filter.value,type:"text",comparison:current_filter.ELC_filter_comparison}; // TODO: user-defined type
				}
				break;
			case "radio":
				if(current_filter.checked)
				{
					if(this.ELC_list_container.ELC_active_filters[field].and == null)
						this.ELC_list_container.ELC_active_filters[field].and = {};
					this.ELC_list_container.ELC_active_filters[field].and[i] = {source:current_filter,value:current_filter.value,type:"text",comparison:current_filter.ELC_filter_comparison}; // TODO: user-defined type
				}
				break;
			case "number":
				if(this.ELC_list_container.ELC_active_filters[field].and == null)
					this.ELC_list_container.ELC_active_filters[field].and = {};
				this.ELC_list_container.ELC_active_filters[field].and[i] = {source:current_filter,value:current_filter.value,type:"number",comparison:current_filter.ELC_filter_comparison};
				break;
			case "select-one":
				if(this.ELC_list_container.ELC_active_filters[field].and == null)
					this.ELC_list_container.ELC_active_filters[field].and = {};
				this.ELC_list_container.ELC_active_filters[field].and[i] = {source:current_filter,value:current_filter.value,type:"text",comparison:current_filter.ELC_filter_comparison}; // TODO: user-defined type
				break;
			case "date":
			case "datetime-local":
				if(this.ELC_list_container.ELC_active_filters[field].and == null)
					this.ELC_list_container.ELC_active_filters[field].and = {};
				this.ELC_list_container.ELC_active_filters[field].and[i] = {source:current_filter,value:Date.parse(current_filter.value),type:"date",comparison:current_filter.ELC_filter_comparison};
				break;
			case "select-multiple":
				var selectedOptions = current_filter.getSelectedOptions();
				for(var k = 0; k < selectedOptions.length; k++)
					if(selectedOptions[k].value != null && selectedOptions[k].value.length > 0)
					{
						if(this.ELC_list_container.ELC_active_filters[field].or == null)
							this.ELC_list_container.ELC_active_filters[field].or = {};
						this.ELC_list_container.ELC_active_filters[field].or[i+"m"+k] = {source:current_filter,value:selectedOptions[k].value,type:"text",comparison:current_filter.ELC_filter_comparison}; // TODO: user-defined type
					}
				break;
			case "text": // TODO: implement quoted text, maybe redo this filter to allow less strict searches
				var string = current_filter.value;
				if(string)
				{
					var strings = string.split(" ");
					for(var s in strings)
					{
						if(strings[s][0] == "+" && strings[s].length > 1)
						{
							if(this.ELC_list_container.ELC_active_filters[field].and == null)
								this.ELC_list_container.ELC_active_filters[field].and = {};
							this.ELC_list_container.ELC_active_filters[field].and[i+"t"+s] = {source:current_filter,value:strings[s].substr(1),type:"text",comparison:current_filter.ELC_filter_comparison};
						}
						else if(strings[s][0] == "|" && strings[s].length > 1)
						{
							if(this.ELC_list_container.ELC_active_filters[field].or == null)
								this.ELC_list_container.ELC_active_filters[field].or = {};
							this.ELC_list_container.ELC_active_filters[field].or[i+"t"+s] = {source:current_filter,value:strings[s].substr(1),type:"text",comparison:current_filter.ELC_filter_comparison};
						}
						else if(strings[s][0] == "-" && strings[s].length > 1)
						{
							if(this.ELC_list_container.ELC_active_filters[field].not == null)
								this.ELC_list_container.ELC_active_filters[field].not = {};
							this.ELC_list_container.ELC_active_filters[field].not[i+"t"+s] = {source:current_filter,value:strings[s].substr(1),type:"text",comparison:current_filter.ELC_filter_comparison};
						}
						else if(strings[s].length > 0)
						{
							if(this.ELC_list_container.ELC_active_filters[field].and == null)
								this.ELC_list_container.ELC_active_filters[field].and = {};
							this.ELC_list_container.ELC_active_filters[field].and[i+"t"+s] = {source:current_filter,value:strings[s],type:"text",comparison:current_filter.ELC_filter_comparison};
						}
					}
				}
				break;
			default:
				console.warn("No filter processing available for element of type: "+ current_filter.type);
		}
	}
	// TODO: save the created elements and don't recreate them if they haven't changed
	if(this.ELC_list_container.ELC_filter_list != null)
	{
		this.ELC_list_container.ELC_filter_list.innerHTML = "";
		for(var i in this.ELC_list_container.ELC_active_filters)
		{
			for(var k in this.ELC_list_container.ELC_active_filters[i].and)
				ELC_createFilterListElement("and", this.ELC_list_container, i, this.ELC_list_container.ELC_active_filters[i].and[k]);
			for(var k in this.ELC_list_container.ELC_active_filters[i].or)
				ELC_createFilterListElement("or", this.ELC_list_container, i, this.ELC_list_container.ELC_active_filters[i].or[k]);
			for(var k in this.ELC_list_container.ELC_active_filters[i].not)
				ELC_createFilterListElement("not", this.ELC_list_container, i, this.ELC_list_container.ELC_active_filters[i].not[k]);
		}
	}
	if(e == null || e.detail == null || !e.detail.ELC_noUpdate)
		ELC_update(this.ELC_list_container, "filter");
	ELC_logFunctionExecution(false);
}

function ELC_createFilterListElement(filter_type, list_container, field, term)
{
	var span = document.createElement("span");
	span.classList.add("filter-"+ filter_type);
	span.ELC_list_container = list_container;
	span.ELC_type = filter_type;
	span.ELC_field = field;
	if(term.type == "date")
		span.ELC_value = (new Date(term.value)).toLocaleString();
	else
		span.ELC_value = term.value;
	span.appendChild(document.createTextNode((field ? field+":" : "") + span.ELC_value));
	span.addEventListener("click", remove_filter);
	list_container.ELC_filter_list.appendChild(span);
}
	
function remove_filter(e)
{
	console.log(e);
}
// ---- End filtering functions ----

// ---- Begin paginating functions ----
function ELC_perpage_change_listener(e)
{
	if(e != null && e.detail != null && e.detail.no_ELC)
		return;
	var val = parseInt(this.value);
	if(val)
		this.ELC_list_container.ELC_perpage = val;
	else if(this.ELC_list_container.ELC_perpage)
		this.value = this.ELC_list_container.ELC_perpage;
	else
		this.value = this.ELC_list_container.ELC_perpage = 60; // TODO: find a way to let the user set the default?
	if(e == null || e.detail == null || !e.detail.ELC_noUpdate)
		ELC_update(this.ELC_list_container, "page");
}
			
function ELC_display_page(list_container)
{
	if(list_container.ELC_current_page == null)
		return;
	ELC_logFunctionExecution(true);
	var list = (list_container.tagName=="TABLE" ? list_container.tBodies[0] : list_container); // TODO: Support multiple tBodies.
	var rows = [];
	for(var i = 0; i < list.children.length; i++)
	{
		list.children[i].classList.remove("paged-out");
		if(!list.children[i].classList.contains("filtered-out") || list_container.dataset.pagesIncludeFiltered != null)
			rows.push(list.children[i]);
	}
	
	if(!list_container.ELC_perpage)
	{
		console.warn("Could not calculate page count because perpage value was not properly set; defaulting to 60.");
		list_container.ELC_perpage = 60; // TODO: find a way to let the user set the default?
	}
	var num_pages = Math.ceil(rows.length/list_container.ELC_perpage);
	if(!rows.length)
	{
		console.warn("Cannot paginate a list that has no elements.");
		list_container.ELC_current_page = -1;
	}
	else if(list_container.ELC_current_page < 0)
		list_container.ELC_current_page = 0;
	else if(list_container.ELC_current_page >= num_pages)
		list_container.ELC_current_page = num_pages-1;
	
	if(list_container.ELC_current_page <= 0)
		for(var i in list_container.ELC_pageup_buttons)
			list_container.ELC_pageup_buttons[i].classList.remove("active");
	else
		for(var i in list_container.ELC_pageup_buttons)
			list_container.ELC_pageup_buttons[i].classList.add("active");
	
	if(list_container.ELC_current_page >= num_pages-1)
		for(var i in list_container.ELC_pagedown_buttons)
			list_container.ELC_pagedown_buttons[i].classList.remove("active");
	else
		for(var i in list_container.ELC_pagedown_buttons)
			list_container.ELC_pagedown_buttons[i].classList.add("active");
	
	for(var i in rows)
	{
		if(i < list_container.ELC_current_page*list_container.ELC_perpage || i >= (list_container.ELC_current_page+1)*list_container.ELC_perpage)
			rows[i].classList.add("paged-out"); // TODO: paged-out and filtered-out classes will never appear together on an element unless data-pages-include-filtered is true. While this doesn't matter if the only CSS applied to them is to make them display:none, it is still technically a bug and might break anyone's plan to reference those classes in their app for their own purposes.
	}
	for(var i in list_container.ELC_currentpage_indicators)
		list_container.ELC_currentpage_indicators[i].innerHTML = (list_container.ELC_current_page+1);
	for(var i in list_container.ELC_maxpage_indicators)
		list_container.ELC_maxpage_indicators[i].innerHTML = num_pages;
	ELC_logFunctionExecution(false);
}
// ---- End paginating functions ----

function ELC_initialize(event)
{
	ELC_logFunctionExecution(true);
	try
	{
		var customEvent = new CustomEvent((event!=null ? event.type : "init"), {detail:{ELC_noUpdate:1}});
	}
	catch(err)
	{
		var customEvent = document.createEvent("customevent");
		customEvent.initCustomEvent((event!=null ? event.type : "init"), false, false, {detail:{ELC_noUpdate:1}})
	}
	
	ELC_initialized = true; // TODO: move this back to the bottom once ELC_setData doesn't rely on it.
	for(var i in ELC_listDataModels["-pre-init-"])
		ELC_setData(ELC_listDataModels["-pre-init-"][i].template_id, ELC_listDataModels["-pre-init-"][i].data, ELC_listDataModels["-pre-init-"][i].auto, ELC_listDataModels["-pre-init-"][i].ajax);
	
	// ---- Begin setting up list containers ----
	var all_containers = [];
	var sortables = document.getElementsByClassName("sortable");
	for(var i = 0; i < sortables.length; i++)
	{
		if(sortables[i].ELC_list_sorters == null)
			sortables[i].ELC_list_sorters = [];
		for(var k in sortables[i].ELC_list_sorters)
		{
			// TODO: Fix this: ELC_getListContainer gets run twice on any valid element here. Once here and once when iterating through document.getElementsByClassName("sort").
			sortables[i].ELC_list_sorters[k].ELC_list_container = ELC_getListContainer(sortables[i].ELC_list_sorters[k], "sortable", ["sort", "sort-group"]);
			if(sortables[i].ELC_list_sorters[k].ELC_list_container != sortables[i])
			{
				sortables[i].ELC_list_sorters[k].removeEventListener("click", ELC_sort_event_listener);
				delete sortables[i].ELC_list_sorters[k];
			}
		}
		if(all_containers.indexOf(sortables[i]) == -1)
			all_containers.push(sortables[i]);
	}
	
	var filterables = document.getElementsByClassName("filterable");
	for(var i = 0; i < filterables.length; i++)
	{
		if(filterables[i].ELC_list_filters == null)
			filterables[i].ELC_list_filters = [];
		filterables[i].ELC_filter_delay = setTimeout(function(){}, 1);
		for(var k in filterables[i].ELC_list_filters)
		{
			// TODO: Fix this: ELC_getListContainer gets run twice on any valid element here. Once here and once when iterating through document.getElementsByClassName("filter").
			filterables[i].ELC_list_filters[k].ELC_list_container = ELC_getListContainer(filterables[i].ELC_list_filters[k], "filterable", ["filter", "filter-group"]);
			if(filterables[i].ELC_list_filters[k].ELC_list_container != filterables[i])
			{
				filterables[i].ELC_list_filters[k].removeEventListener("keyup", ELC_filter_change_listener);
				filterables[i].ELC_list_filters[k].removeEventListener("change", ELC_filter_change_listener);
				delete filterables[i].ELC_list_filters[k];
			}
		}
		if(all_containers.indexOf(filterables[i]) == -1)
			all_containers.push(filterables[i]);
	}
	
	var pages = document.getElementsByClassName("paged");
	for(var i = 0; i < pages.length; i++)
	{
		if(pages[i].ELC_current_page == null)
			pages[i].ELC_current_page = 0;
		if(pages[i].ELC_pageup_buttons == null)
			pages[i].ELC_pageup_buttons = [];
		if(pages[i].ELC_pagedown_buttons == null)
			pages[i].ELC_pagedown_buttons = [];
		if(pages[i].ELC_currentpage_indicators == null)
			pages[i].ELC_currentpage_indicators = [];
		if(pages[i].ELC_maxpage_indicators == null)
			pages[i].ELC_maxpage_indicators = [];
		if(pages[i].dataset.perpage)
			pages[i].ELC_perpage = parseInt(pages[i].dataset.perpage);
		if(all_containers.indexOf(pages[i]) == -1)
			all_containers.push(pages[i]);
	}
	
	for(var i in all_containers)
	{
		if(all_containers[i].style.position == "static") // this is only needed if transitions are in use
			all_containers[i].style.position = "relative";
		if(all_containers[i].tagName == "TABLE")
			all_containers[i].tHead.updatePracticalCellIndices();
	}
	
	for(var i = 0; i < filterables.length; i++)
	{
		if(filterables[i].tagName == "TABLE")
		{
			filterables[i].ELC_filter_columns = {};
			for(var k = 0; k < filterables[i].tHead.rows.length; k++)
			{
				for(var j = 0; j < filterables[i].tHead.rows[k].cells.length; j++)
				{
					var cell = filterables[i].tHead.rows[k].cells[j];
					if(cell.dataset.field != null)
						filterables[i].ELC_filter_columns[cell.dataset.field.toLowerCase()] = cell.practicalCellIndex;
					else
						filterables[i].ELC_filter_columns[cell.innerText.toLowerCase()] = cell.practicalCellIndex;
				}
			}
		}
	}
	// ---- End setting up list containers ----
	
	var sorts = document.getElementsByClassName("sort");
	for(var i = 0; i < sorts.length; i++)
	{
		sorts[i].ELC_list_container = ELC_getListContainer(sorts[i], "sortable", ["sort", "sort-group"]);
		if(sorts[i].ELC_list_container != null)
		{
			if(sorts[i].practicalCellIndex != null)
				sorts[i].ELC_field = sorts[i].practicalCellIndex;
			else if(sorts[i].dataset.field != null)
				sorts[i].ELC_field = sorts[i].dataset.field;
			else
				sorts[i].ELC_field = sorts[i].innerText;
			if(sorts[i].dataset.type == "number" || sorts[i].dataset.type == "html" || sorts[i].dataset.type == "text" || sorts[i].dataset.type == "date")
				sorts[i].ELC_sort_type = sorts[i].dataset.type;
			else
				sorts[i].ELC_sort_type = "text";
			
			if(sorts[i].ELC_list_container.ELC_list_sorters.indexOf(sorts[i]) == -1)
			{
				sorts[i].ELC_list_container.ELC_list_sorters.push(sorts[i]);
				sorts[i].addEventListener("click", ELC_sort_event_listener);
			}
		}
	}
	
	var initial_sorts = document.getElementsByClassName("sort-initial");
	for(var i = 0; i < initial_sorts.length; i++)
	{
		if(initial_sorts[i].ELC_list_container != null)
		{
			ELC_sort_event_listener.call(initial_sorts[i], customEvent);
			initial_sorts[i].classList.remove("sort-initial");
			// Above line prevents the sort order from being reinitialized to this field if the sortables are reinitialized. Whether we want that, or to let the list stay sorted as it was, who knows?
		}
	}
	
	var filter_lists = document.getElementsByClassName("filter-list");
	for(var i = 0; i < filter_lists.length; i++)
	{
		filter_lists[i].ELC_list_container = ELC_getListContainer(filter_lists[i], "filterable", ["filter-list", "filter-group"]);
		if(filter_lists[i].ELC_list_container != null)
			if(filter_lists[i].ELC_list_container.ELC_filter_list != filter_lists[i])
				filter_lists[i].ELC_list_container.ELC_filter_list = filter_lists[i];
	}
	
	var filters = document.getElementsByClassName("filter");
	for(var i = 0; i < filters.length; i++)
	{
		filters[i].ELC_list_container = ELC_getListContainer(filters[i], "filterable", ["filter", "filter-group"]);
		if(filters[i].ELC_list_container != null)
		{
			if(filters[i].dataset.field != null)
				filters[i].ELC_field = filters[i].dataset.field;
			else
				filters[i].ELC_field = "";
			switch(filters[i].dataset.comparison)
			{
				case ">=":
				case "=>":
					filters[i].ELC_filter_comparison = ">=";
					break;
				case "<=":
				case "=<":
					filters[i].ELC_filter_comparison = "<=";
					break;
				case ">":
					filters[i].ELC_filter_comparison = ">";
					break;
				case "<":
					filters[i].ELC_filter_comparison = "<";
					break;
				case "==":
				case "=":
					filters[i].ELC_filter_comparison = "=";
					break;
				case "*=":
					filters[i].ELC_filter_comparison = "*=";
					break;
				case "~=":
					filters[i].ELC_filter_comparison = "~=";
					break;
				default:
					filters[i].ELC_filter_comparison = "";
			}
			if(filters[i].dataset.applyControl != null)
			{
				if(filters[i].dataset.applyControl[0] == ".")
					var controller = document.getElementsByClassName(filters[i].dataset.applyControl.substr(1));
				else
					var controller = document.getElementById(filters[i].dataset.applyControl.substr(filters[i].dataset.applyControl[0]=="#"?1:0));
				if(controller != null && (controller.length == null || controller.length > 0))
				{
					var controllers = (controller.length == null ? [controller] : controller);
					for(var k = 0; k < controllers.length; k++)
					{
						if(filters[i].ELC_appliers == null)
							filters[i].ELC_appliers = [controllers[k]];
						else
							filters[i].ELC_appliers.push(controllers[k]);
						if(controllers[k].ELC_filters == null)
							controllers[k].ELC_filters = [filters[i]];
						else
							controllers[k].ELC_filters.push(filters[i]);
						controllers[k].addEventListener("click", ELC_filter_controller_listener);
					}
				}
			}
			if(filters[i].dataset.resetControl != null)
			{
				if(filters[i].dataset.resetControl[0] == ".")
					var controller = document.getElementsByClassName(filters[i].dataset.resetControl.substr(1));
				else
					var controller = document.getElementById(filters[i].dataset.resetControl.substr(filters[i].dataset.resetControl[0]=="#"?1:0));
				if(controller != null && (controller.length == null || controller.length > 0))
				{
					if(filters[i].type == "select-multiple")
						for(var k = 0; k < filters[i].options.length; k++)
							filters[i].options[k].ELC_resetValue = filters[i].options[k].selected;
					else if(filters[i].type == "checkbox" || filters[i].type == "radio")
						filters[i].ELC_resetValue = filters[i].checked;
					else
						filters[i].ELC_resetValue = filters[i].value;
					var controllers = (controller.length == null ? [controller] : controller);
					for(var k = 0; k < controllers.length; k++)
					{
						if(filters[i].ELC_resetters == null)
							filters[i].ELC_resetters = [controllers[k]];
						else
							filters[i].ELC_resetters.push(controllers[k]);
						if(controllers[k].ELC_filters == null)
							controllers[k].ELC_filters = [filters[i]];
						else
							controllers[k].ELC_filters.push(filters[i]);
						controllers[k].addEventListener("click", ELC_filter_controller_listener);
					}
				}
			}
			if(filters[i].dataset.clearControl != null)
			{
				if(filters[i].dataset.clearControl[0] == ".")
					var controller = document.getElementsByClassName(filters[i].dataset.clearControl.substr(1));
				else
					var controller = document.getElementById(filters[i].dataset.clearControl.substr(filters[i].dataset.clearControl[0]=="#"?1:0));
				if(controller != null && (controller.length == null || controller.length > 0))
				{
					var controllers = (controller.length == null ? [controller] : controller);
					for(var k = 0; k < controllers.length; k++)
					{
						if(filters[i].ELC_clearers == null)
							filters[i].ELC_clearers = [controllers[k]];
						else
							filters[i].ELC_clearers.push(controllers[k]);
						if(controllers[k].ELC_filters == null)
							controllers[k].ELC_filters = [filters[i]];
						else
							controllers[k].ELC_filters.push(filters[i]);
						controllers[k].addEventListener("click", ELC_filter_controller_listener);
					}
				}
			}
			if(filters[i].ELC_list_container.ELC_list_filters.indexOf(filters[i]) == -1)
			{
				filters[i].ELC_list_container.ELC_list_filters.push(filters[i]);
				if(filters[i].ELC_appliers == null)
				{
					filters[i].addEventListener("keyup", ELC_filter_change_listener);
					filters[i].addEventListener("change", ELC_filter_change_listener);
				}
				if(filters[i].value != "") // TODO: Might be able to collect these and execute ELC_filter_change_listener once per list rather than iteratively calling it for each filter
				{
					ELC_filter_change_listener.call(filters[i], customEvent);
				}
			}
		}
	}
	
	var currentpages = document.getElementsByClassName("page-current");
	for(var i = 0; i < currentpages.length; i++)
	{
		currentpages[i].ELC_list_container = ELC_getListContainer(currentpages[i], "paged", ["page-current", "page-group"]);
		if(currentpages[i].ELC_list_container != null)
		{
			if(currentpages[i].ELC_list_container.ELC_currentpage_indicators.indexOf(currentpages[i]) == -1)
			{
				currentpages[i].ELC_list_container.ELC_currentpage_indicators.push(currentpages[i]);
			}
		}
	}
	
	var maxpages = document.getElementsByClassName("page-max");
	for(var i = 0; i < maxpages.length; i++)
	{
		maxpages[i].ELC_list_container = ELC_getListContainer(maxpages[i], "paged", ["page-max", "page-group"]);
		if(maxpages[i].ELC_list_container != null)
		{
			if(maxpages[i].ELC_list_container.ELC_maxpage_indicators.indexOf(maxpages[i]) == -1)
			{
				maxpages[i].ELC_list_container.ELC_maxpage_indicators.push(maxpages[i]);
			}
		}
	}
	
	var pageups = document.getElementsByClassName("pageup");
	for(var i = 0; i < pageups.length; i++)
	{
		pageups[i].ELC_list_container = ELC_getListContainer(pageups[i], "paged", ["pageup", "page-group"]);
		if(pageups[i].ELC_list_container != null)
		{
			if(pageups[i].ELC_list_container.ELC_pageup_buttons.indexOf(pageups[i]) == -1)
			{
				pageups[i].ELC_list_container.ELC_pageup_buttons.push(pageups[i]);
				pageups[i].addEventListener("click", function(e){
					if(!this.classList.contains("active"))
						return;
					this.ELC_list_container.ELC_current_page = this.ELC_list_container.ELC_current_page-1;
					ELC_update(this.ELC_list_container, "page");
				});
			}
		}
	}
	
	var pagedowns = document.getElementsByClassName("pagedown");
	for(var i = 0; i < pagedowns.length; i++)
	{
		pagedowns[i].ELC_list_container = ELC_getListContainer(pagedowns[i], "paged", ["pagedown", "page-group"]);
		if(pagedowns[i].ELC_list_container != null)
		{
			if(pagedowns[i].ELC_list_container.ELC_pagedown_buttons.indexOf(pagedowns[i]) == -1)
			{
				pagedowns[i].ELC_list_container.ELC_pagedown_buttons.push(pagedowns[i]);
				pagedowns[i].addEventListener("click", function(e){
					if(!this.classList.contains("active"))
						return;
					this.ELC_list_container.ELC_current_page = this.ELC_list_container.ELC_current_page+1;
					ELC_update(this.ELC_list_container, "page");
				});
			}
		}
	}
	
	var perpages = document.getElementsByClassName("perpage");
	for(var i = 0; i < perpages.length; i++)
	{
		perpages[i].ELC_list_container = ELC_getListContainer(perpages[i], "paged", ["perpage", "page-group"]);
		if(perpages[i].ELC_list_container != null)
		{
			perpages[i].addEventListener("change", ELC_perpage_change_listener);
			ELC_perpage_change_listener.call(perpages[i], customEvent);
		}
	}
	
	for(var i in all_containers)
	{
		ELC_update(all_containers[i], "init");
		var list_collection = (all_containers[i].tagName=="TABLE" ? all_containers[i].tBodies : [all_containers[i]]); // I don't like creating a random array here but it's cleaner than anything else I thought of.
		for(var k = 0; k < list_collection.length; k++)
		{
			if(list_collection[k].ELC_MutationObserver == null)
				list_collection[k].ELC_MutationObserver = new MutationObserver(ELC_observerCallback);
			list_collection[k].ELC_MutationObserver.observe(list_collection[k], {childList:true});
		}
	}
	ELC_logFunctionExecution(false);
};

document.addEventListener("DOMContentLoaded", ELC_initialize);
