# Element List Controller
Provides robust options for sorting, filtering, paginating, or otherwise displaying lists of data in the form of HTML elements. Data can be laid out in an TABLE with TR rows inside of a TBODY representing each data record, or in any other element with child elements representing each data record.

Browser compatility is not a focus of this project. Development versions are only tested on the latest Firefox and Chrome, with releases also tested on Internet Explorer 11 for basic functionality. Any browser older than that is likely to experience problems. However, any standards-compliant browser should have no issues.

Terminology used throughout this readme is as follows:
* __list container__: The DOM element that you have applied the `sortable`/`filtered`/`paged` class(es) to.
* __list__: If the list container is a TABLE element, then the list is the first TBODY child of it. Otherwise, the list and list container are the same thing.
* __record__: Each individual DOM element child of the list which contains the data that you wish to display.
* __field__: A piece of data present on all of the records, which you plan on using to sort or filter the records.

* [Usage](#usage)
	* <a href="#sorting">Sorting</a>
		* <a href="#sorting-css">CSS</a>
	* <a href="#filtering">Filtering</a>
		* <a href="#filtering-css">CSS</a>
		* <a href="#filtering-options">Filtering Options</a>
	* <a href="#paginating">Paginating</a>
		* <a href="#paginating-css">CSS</a>
## Usage
Include the following anywhere in your HTML document:
```html
<script src="https://kree-nickm.github.io/element-list-controller/elc.js"></script>
```
This will include the development version of this script. To load a specific release (recommended in case future versions alter or remove funtionality), use the URL for that release instead, ie. `element-list-controller/1.0.0/elc.min.js`. You can also download the JavaScript file and host it on your own server, loading it from there.

For usage examples, check out [the demo page](https://kree-nickm.github.io/element-list-controller/index.html). Some features of the script require CSS in order to function as expected, so also check out the [basic CSS file](https://kree-nickm.github.io/element-list-controller/basic.css) for recommended CSS to include.

Records added to the list dynamically after the page has loaded will be updated automatically, provided the browser supports `MutationObserver` (IE11 does not). Otherwise, `ELC_update(list_container)` should be called after you add your record elements, where `list_container` is the list container DOM element. You must also manually update if any records are changed in a way that would affect the sorting/filtering, as only new DOM element additions are observed at this time.

Adding entirely new list containers to the DOM dynamically after the page has loaded is not fully supported. You can call `ELC_initialize()` after adding your new DOM elements, but this is not tested very thoroughly and should not be used in a production environment.
### Sorting
To make an element a sortable list container, add the `sortable` class to it. You should also give it a unique `id` attribute.
#### Sorters
To designate an HTML element as a clickable sorting button (sorter), add the `sort` class to it and specify which list container it applies to in one of the following ways:
* Make the sorter element a descendant of the list container element. This should be done if and only if your list container is a TABLE element. In that case, usually your sorters will be the TH header cells within the table's THEAD element.
* Add the `data-container` attribute to the sorter, with a value equal to the `id` of your list container.
* Add an element with the `sort-group` class, add the `data-container` attribute (as above) to this group element, and then make the sorter element a descendant of this group element. This is a shortcut for when you have many sorter elements in a group and do not want to have to specify the list container on all of them.

You must then specify what field of the records your sorter will be sorting by. Do this in one of the following ways:
* If your list container is a TABLE element, you don't have to do anything but make sure this sorter is the header of the column you want it to sort by.
* Otherwise, you need to add the `data-field` attribute to the sorter, with the value corresponding to a field represented within the HTML of the records. Setting up the fields on your records is described below.

Optionally, you can specify what type of data that the sorter will be working with. Do so by adding the `data-type` attribute to the sorter, with one of the following values:
* __text__: Default. The data will be sorted alphabetically by its text content, ignoring any HTML tags.
* __number__: The data will be parsed into a number and sorted from lowest to highest.
* __html__: The data will be sorted alphabetically by the full HTML, tags and all.

Sort order can be reversed by repeatedly clicking the sorter. If you want it to be sorted in descending order on the first click instead, then add the `data-order` attribute to the sorter with any value starting with `D` (case insensitive).
#### Defining Field Data to Sort By
The records inside your list might need to be set up with specific HTML before sorting will work. If your list container is a TABLE, then you generally do not need to do anything. When a sorting column header is clicked, the records will be sorted by the content of the TD (or TH) cells in that column according to the specifications given in the sorter. You can optionally use the `data-value` and `data-<field>-value` attributes (described below) in the cell and TR elements respectively if you need to. For non-TABLE list containers, however, the records need to have their fields specified in order for the data to be recognized. This can be done in three ways:
* A record's HTML element can include a `data-<field>-value` attribute. Replace `<field>` with the field name specified in the desired sorter. The value of the attribute is the data used for sorting.
* A descendant HTML element of the record's element can include a `name` attribute with the value set to the field name specified in the desired sorter. The data used for sorting will be the content of the HTML element. Unless...
* Same as above, except also include a `data-value` attribute with the `name` attribute. In this case, the value of this attribute will be the data used for sorting.
#### Animated Sorting
Sorting can be animated by including a `data-sort-transition-time` attribute in the list container element. The value of the attribute follows the conventions of the `transition` [CSS3 property](https://www.w3schools.com/cssref/css3_pr_transition.asp), but without the _property_ parameter. For example, `data-sort-transition-time=".5s ease-in-out 0s"`. The transition will be applied via CSS to the necessary elements automatically.

Animation is still experimental. It permanently toys with the positional CSS properties, which could conflict with any existing CSS you have defined. Make sure you test it to make sure it looks good with your HTML before you actually use it. Animation will also not look good if the list container is paginated, so you probably shouldn't use it in that case either.
#### Sorting CSS
Certain CSS classes will be added to certain elements as the sorting methods are activated. The `sortdown` class will be added to a sorter element when it is clicked and the list is being sorted in ascending/alphabetical order by its specified field. The `sortup` class will be added instead if the list is being sorted in descending/reverse alphabetical order by that field. Here is some example CSS to have the sorters reflect which sorter is currently active:
```css
.sort.sortup:after {
	content: "\2191";
}
.sort.sortdown:after {
	content: "\2193";
}
```
Additionally, it is likely that users will rapidly click on the sorters. To prevent text from being awkwardly highlighted when they do this, the following CSS may be desireable as well. It also uses a pointer cursor to indicate the the sorter is an interactable element:
```css
.sortable .sort,
.sorter[data-container] .sort,
.sort[data-container] {
	cursor: pointer;
	user-select: none;
	-webkit-user-select: none;
	-moz-user-select: none;
	-khtml-user-select: none;
	-ms-user-select: none;
}
```
### Filtering
Add the `filtered` class to a `<table>` element (referred to as the list container). The `<table>` must utilize the `<thead>` and `<tbody>` elements to distingush the header row(s) from the table content to be filtered.

The only columns in the table that can be filtered upon are the ones that are topped with a header (`<th>` or `<td>`) containing the `filterable` class. Additionally, you can also add the `data-column` attribute to these header cells to give the column a more simple identifier. Otherwise, the identifier will be based on the text content of the header, which could cause problems in certain implementations or if the text is changed later without also changing any column-specific filter inputs.

To filter the list container, use `<input>` elements with the `filter` class. These filter elements can either be inside the list container element, or anywhere else on the page with an additional `data-table` element. That `data-table` element must be a jQuery selector corresponding to the list container to be filtered, ie. `data-table="#demotable"` then the list container has `id="demotable"`.

By default, the filter input will search every field of a list element that corresponds to a header field marked as `filterable`. However, if you wish for a certain filter input to only search a specific field of a list element, then include the `data-column` attribute on the input element. The value of the attribute must either correspond to the `data-column` attribute of a header, or to the text content of a filterable header converted to lowercase. Usage of the `data-column` attribute is recommended.

Finally, a list of currently applied filters can be displayed if an element with the `filter-list` is included inside of the list container. That element's innerHTML will be populated with `<span>` elements representing all applies filters. This is experimental for now and will be improved upon in later releases.

Note that the JavaScript does not explicitly hide the list elements that are filtered out. It instead adds the `filtered-out` class to them. In order to make them hidden, you must use CSS (see below).
<a name="filtering-css"></a>
#### CSS
The `filtered-out` class will be added to any list element that does not match the currently applied filters. Use the following CSS to hide elements from view when they are not on the current page:
```css
.filtered .filtered-out {
	display: none;
}
```
If you are also using the `filter-list` feature, then additional classes will be appended to the child elements of the filter list. `filter-and`, `filter-or`, and `filter-not` classes will be added to any filter terms that are and-separated, or-separated, or negated, respectively.
<a name="filtering-options"></a>
#### Filter Options
For the end-user actually viewing and using the list container, the filter inputs work as follows:
* Spaces separate each term entered into the field, and each term is considered a separate filter.
* All terms are normally "and-separated", meaning *all* of them must be present in a list element, or that element will be filtered out.
* Terms can be prepended with a `|` to make them "or-separated". Only one "or-separated" term must be present in a list element for it to be considered a match.
* Terms can be negated by prepending a `-`. List items will be filtered out if they contain any negated term.
<a name="paginating"></a>
### Paginating
Add the `paged` class to a `<table>` element (referred to as the list container). Anywhere within the `<table>` element, you will also need to add any or all of the following elements with the specified classes:
* Any element with the `pageup` class. When this element is clicked, the list container will display the previous page.
* Any element with the `pagedown` class. When this element is clicked, the list container will display the next page.
* Any element with the `page` class. The innerHTML of this element will be replaced with the current page and total pages, ie. "Page 2 of 5".
* An `<input>` element with the `perpage` class. This should also have the `type` attribute set to `number`. When this number is changed, it will specify the number of list elements displayed on each page of the list container.

The script accounts for any filtered list elements, so both features can be used simultaneously. Note that the JavaScript does not explicitly hide the list elements that are not on the current page. It instead adds the `paged-out` class to them. In order to make them hidden, you must use CSS (see below).
<a name="paginating-css"></a>
#### CSS
The `paged-out` class will be added to any list element that is not on the current page of the list container. Use the following CSS to hide elements from view when they are not on the current page:
```css
.paged .paged-out {
	display: none;
}
```
Additionally, the following CSS may be desirable in order to prevent the designated "next page" and "previous page" elements from having their text highlighted when rapidly clicked:
```css
.paged .pageup,
.paged .pagedown {
	cursor: pointer;
	user-select: none;
	-webkit-user-select: none;
	-moz-user-select: none;
	-khtml-user-select: none;
	-ms-user-select: none;
}
```
Finally, the `active` class will be present on the designated "next page" and "previous page" elements while there actually is a next or previous page, respectively. The following CSS can be used to dim those elements when the first or last page is currently visible:
```css
.paged .pageup,
.paged .pagedown {
	opacity: 0.5;
}

.paged .pageup.active,
.paged .pagedown.active {
	opacity: 1;
}
```
